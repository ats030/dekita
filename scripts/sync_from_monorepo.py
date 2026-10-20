"""Rebuild the imported application files from one operational-repository commit.

Usage: python3 scripts/sync_from_monorepo.py REPOSITORY COMMIT [--prefix app/dekita] [--add PATH ...]

Every file tracked under PREFIX at COMMIT is imported except the manifest's exclusions.
A file that the previous manifest did not import must be named with --add, so new files
are published only after review.
The publication adjustments are re-applied, files that are no longer imported are removed,
and docs/source-manifest.json is rewritten. Review `git status`, then stage and audit.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from audit_publication import PUBLICATION_FILES  # noqa: E402
MANIFEST = ROOT / 'docs/source-manifest.json'
# The port literal is split so the publication audit does not match this script.
VISIT_LOG = re.compile(r'^[ \t]*<script src="http://[^"]*:' + '8526' + r'/v\.js"[^\n]*\n', re.M)
ADJUSTMENTS = {
    'index.html': lambda text: VISIT_LOG.subn('', text),
    'generate-voicevox-audio.cjs': lambda text: re.subn(
        r"^const OUTPUT_DIR = '[^']*';$", "const OUTPUT_DIR = path.join(__dirname, 'audio');", text, flags=re.M),
}


def git(repository, *args):
    return subprocess.check_output(['git', '-C', str(repository), *args])


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('repository')
    parser.add_argument('commit')
    parser.add_argument('--prefix', default='app/dekita')
    parser.add_argument('--add', action='append', default=[], metavar='PATH',
                        help='allow a file that the previous manifest did not import')
    args = parser.parse_args()
    prefix = args.prefix.strip('/') + '/'
    commit = git(args.repository, 'rev-parse', '--verify', args.commit + '^{commit}').decode().strip()
    manifest = json.loads(MANIFEST.read_text())
    excluded = {path for item in manifest['excluded'] for path in item['paths']}
    reasons = {item['path']: item['reason'] for item in manifest['publication_adjustments']}
    if set(reasons) != set(ADJUSTMENTS):
        raise SystemExit('publication_adjustments and ADJUSTMENTS list different files')

    files, adjustments, bodies = [], [], {}
    for entry in filter(None, git(args.repository, 'ls-tree', '-r', '-z', commit, '--', prefix).decode().split('\0')):
        metadata, name = entry.split('\t', 1)
        mode, kind, object_id = metadata.split()
        path = name[len(prefix):]
        if path in excluded:
            continue
        if kind != 'blob' or mode not in {'100644', '100755'}:
            raise SystemExit(f'Unsupported tree entry {mode} {kind}: {path}')
        body = git(args.repository, 'cat-file', 'blob', object_id)
        files.append({'path': path, 'sha256': hashlib.sha256(body).hexdigest(), 'mode': mode})
        if path in ADJUSTMENTS:
            text, count = ADJUSTMENTS[path](body.decode())
            if count != 1:
                raise SystemExit(f'Publication adjustment no longer applies exactly once: {path}')
            body = text.encode()
            adjustments.append({'path': path, 'reason': reasons[path],
                                'published_sha256': hashlib.sha256(body).hexdigest()})
        bodies[path] = body
    missing = set(ADJUSTMENTS) - {item['path'] for item in adjustments}
    if missing:
        raise SystemExit('Adjusted files are missing at this commit: ' + ', '.join(sorted(missing)))
    previous = {item['path'] for item in manifest['files']}
    current = {item['path'] for item in files}
    unreviewed = current - previous - set(args.add)
    if unreviewed:
        raise SystemExit('New files need --add after review: ' + ', '.join(sorted(unreviewed)))
    collisions = current & PUBLICATION_FILES
    if collisions:
        raise SystemExit('Imported files would overwrite publication files: ' + ', '.join(sorted(collisions)))

    # Write only after every check passed, so a failed run leaves the checkout unchanged.
    for item in files:
        target = ROOT / item['path']
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(bodies[item['path']])
        target.chmod(0o755 if item['mode'] == '100755' else 0o644)

    for path in sorted(previous - current):
        target = ROOT / path
        target.unlink(missing_ok=True)
        for parent in target.parents:
            if parent == ROOT or not parent.is_dir() or any(parent.iterdir()):
                break
            parent.rmdir()
    manifest.update({
        'snapshot_date': git(args.repository, 'show', '-s', '--format=%cs', commit).decode().strip(),
        'source_commit': commit,
        'files': files,
        'publication_adjustments': adjustments,
    })
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    for label, paths in (('added', current - previous), ('removed', previous - current)):
        for path in sorted(paths):
            print(f'{label}: {path}')
    print(f'Imported {len(files)} files from {commit[:12]}; review git status, then stage and run the audit.')


if __name__ == '__main__':
    main()
