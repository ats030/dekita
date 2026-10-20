"""Regression checks for what the publication audit will actually commit."""
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
# Keep git hooks' GIT_DIR/GIT_INDEX_FILE from redirecting the scratch repository.
ENV = {key: value for key, value in os.environ.items() if not key.startswith('GIT_')}


def audit(root):
    return subprocess.run([sys.executable, 'scripts/audit_publication.py'], cwd=root, env=ENV,
                          text=True, capture_output=True)


def stage(root, *paths):
    subprocess.run(['git', 'add', *paths], cwd=root, env=ENV, check=True)


class PublicationAuditTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        subprocess.run(['git', 'init', '-q', str(self.root)], env=ENV, check=True)
        (self.root / 'scripts').mkdir()
        (self.root / 'docs').mkdir()
        shutil.copyfile(ROOT / 'scripts/audit_publication.py', self.root / 'scripts/audit_publication.py')
        body = b'console.log("example");\n'
        (self.root / 'main.js').write_bytes(body)
        manifest = {'files': [{'path': 'main.js', 'sha256': hashlib.sha256(body).hexdigest()}],
                    'publication_adjustments': []}
        (self.root / 'docs/source-manifest.json').write_text(json.dumps(manifest))
        stage(self.root, '.')

    def tearDown(self):
        self._tmp.cleanup()

    def test_valid_reviewed_index_passes(self):
        result = audit(self.root)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_unknown_staged_artifact_is_rejected(self):
        (self.root / 'private-recording.mp3').write_bytes(b'benign-looking bytes')
        stage(self.root, 'private-recording.mp3')
        result = audit(self.root)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('outside-publication-allowlist', result.stderr)

    def test_staged_secret_is_rejected_even_when_worktree_is_clean(self):
        path = self.root / 'README.md'
        path.write_text('sk-proj-' + 'A' * 60)
        stage(self.root, 'README.md')
        path.write_text('clean working copy')
        result = audit(self.root)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('provider-key: README.md', result.stderr)
        self.assertNotIn('A' * 60, result.stderr)

    def test_lan_visit_log_tag_is_rejected(self):
        (self.root / 'README.md').write_text('<script src="http://lan-host:8526' + '/v.js"></script>')
        stage(self.root, 'README.md')
        self.assertIn('lan-visit-log-tag: README.md', audit(self.root).stderr)

    def test_staged_source_mismatch_is_rejected(self):
        (self.root / 'main.js').write_text('console.log("unreviewed change");\n')
        stage(self.root, 'main.js')
        self.assertIn('source-integrity: main.js', audit(self.root).stderr)


if __name__ == '__main__':
    unittest.main()
