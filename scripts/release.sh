#!/bin/sh
# Builds, commits dist and tags a release. It doesn't push.
# Usage: scripts/release.sh 0.2.0
set -e
version="$1"
case "$version" in
  [0-9]*.[0-9]*.[0-9]*) ;;
  *) echo "Usage: scripts/release.sh X.Y.Z" >&2; exit 1 ;;
esac
# dist is left out because it's rebuilt below.
if [ -n "$(git status --porcelain -- . ':!dist')" ]; then
  echo "Refusing to release: commit or remove your changes first." >&2
  exit 1
fi
if git rev-parse -q --verify "refs/tags/v$version" >/dev/null; then
  echo "Refusing to release: v$version already exists, and tags never move." >&2
  exit 1
fi
npm version "$version" --no-git-tag-version --allow-same-version >/dev/null
npm run build
git add dist package.json package-lock.json
git commit -m "Release v$version"
git tag "v$version"
echo "Tagged v$version. Nothing was pushed."
