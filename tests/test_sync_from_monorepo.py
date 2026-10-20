"""Regression checks for rebuilding the imported files from an operational commit."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
ENV = {key: value for key, value in os.environ.items() if not key.startswith('GIT_')}
# Split so the publication audit does not match this test.
TAG = '  <script src="http://lan-host:' + '8526' + '/v.js" defer></script>\n'


class SyncFromMonorepoTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.source = Path(self._tmp.name, 'source')
        self.root = Path(self._tmp.name, 'portfolio')
        app = self.source / 'app/dekita'
        app.mkdir(parents=True)
        (self.root / 'scripts').mkdir(parents=True)
        (self.root / 'docs').mkdir()
        for name in ('sync_from_monorepo.py', 'audit_publication.py'):
            shutil.copyfile(ROOT / 'scripts' / name, self.root / 'scripts' / name)
        (self.root / 'old.js').write_text('retired\n')
        reasons = ['index.html', 'migration.html', 'generate-voicevox-audio.cjs']
        (self.root / 'docs/source-manifest.json').write_text(json.dumps({
            'excluded': [{'paths': ['Dockerfile'], 'reason': 'retired'}],
            'files': [{'path': 'old.js', 'sha256': '', 'mode': '100644'}],
            'publication_adjustments': [{'path': p, 'reason': 'r', 'published_sha256': ''} for p in reasons]}))
        for name in ('index.html', 'migration.html'):
            (app / name).write_text('<head>\n' + TAG + '</head>\n')
        (app / 'generate-voicevox-audio.cjs').write_text("const OUTPUT_DIR = '/srv/app/audio';\n")
        (app / 'main.js').write_text('main\n')
        (app / 'Dockerfile').write_text('FROM retired\n')
        self.commit()
        self.manifest = (self.root / 'docs/source-manifest.json').read_bytes()

    def tearDown(self):
        self._tmp.cleanup()

    def commit(self):
        git = ['git', '-C', str(self.source), '-c', 'user.name=t', '-c', 'user.email=t@example.invalid']
        subprocess.run(git[:3] + ['init', '-q'], env=ENV, check=True)
        subprocess.run(git + ['add', '.'], env=ENV, check=True)
        subprocess.run(git + ['commit', '-qm', 'snapshot'], env=ENV, check=True)

    def sync(self, *extra):
        return subprocess.run([sys.executable, 'scripts/sync_from_monorepo.py', str(self.source), 'HEAD',
                               '--add', 'generate-voicevox-audio.cjs', '--add', 'index.html',
                               '--add', 'migration.html', *extra],
                              cwd=self.root, env=ENV, text=True, capture_output=True)

    def test_imports_adjusts_excludes_and_removes(self):
        result = self.sync('--add', 'main.js')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual((self.root / 'index.html').read_text(), '<head>\n</head>\n')
        self.assertIn("path.join(__dirname, 'audio')", (self.root / 'generate-voicevox-audio.cjs').read_text())
        self.assertFalse((self.root / 'Dockerfile').exists())
        self.assertFalse((self.root / 'old.js').exists())
        manifest = json.loads((self.root / 'docs/source-manifest.json').read_text())
        files = {item['path']: item['sha256'] for item in manifest['files']}
        self.assertEqual(sorted(files), ['generate-voicevox-audio.cjs', 'index.html', 'main.js', 'migration.html'])
        source = (self.source / 'app/dekita/index.html').read_bytes()
        self.assertEqual(files['index.html'], hashlib.sha256(source).hexdigest())
        published = {item['path']: item['published_sha256'] for item in manifest['publication_adjustments']}
        self.assertEqual(published['index.html'], hashlib.sha256(b'<head>\n</head>\n').hexdigest())
        self.assertEqual(len(manifest['source_commit']), 40)

    def assert_unchanged(self, result, message):
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(message, result.stderr)
        self.assertEqual((self.root / 'old.js').read_text(), 'retired\n')
        self.assertFalse((self.root / 'main.js').exists())
        self.assertEqual((self.root / 'docs/source-manifest.json').read_bytes(), self.manifest)

    def test_adjustment_that_no_longer_applies_fails(self):
        (self.source / 'app/dekita/index.html').write_text('<head>\n</head>\n')
        self.commit()
        self.assert_unchanged(self.sync('--add', 'main.js'), 'no longer applies exactly once: index.html')

    def test_unreviewed_new_file_fails(self):
        self.assert_unchanged(self.sync(), 'New files need --add after review: main.js')

    def test_publication_file_collision_fails(self):
        (self.source / 'app/dekita/README.md').write_text('operational readme\n')
        self.commit()
        self.assert_unchanged(self.sync('--add', 'main.js', '--add', 'README.md'),
                              'would overwrite publication files: README.md')

    def test_removed_file_in_missing_directory_is_ignored(self):
        manifest = json.loads(self.manifest)
        manifest['files'].append({'path': 'gone/deeper/file.js', 'sha256': '', 'mode': '100644'})
        (self.root / 'docs/source-manifest.json').write_text(json.dumps(manifest))
        result = self.sync('--add', 'main.js')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotIn('gone/deeper/file.js', (self.root / 'docs/source-manifest.json').read_text())


if __name__ == '__main__':
    unittest.main()
