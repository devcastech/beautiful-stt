#!/usr/bin/env bash
# Usage: scripts/publish.sh  (dev branch, after the release PR is merged into main)
set -euo pipefail
cd "$(dirname "$0")/.."

die() { echo "$1" >&2; exit 1; }

[[ $(git branch --show-current) == dev ]] || die "Must run on the dev branch"
[[ -z $(git status --porcelain -uno) ]] || die "Working tree has uncommitted changes"
git fetch origin --tags --quiet

VERSION=$(git show origin/main:package.json | sed -nE '/"version":/{s/.*"version": "([^"]+)".*/\1/p;q}')
TAG="v$VERSION"
git rev-parse -q --verify "refs/tags/$TAG" >/dev/null && die "Tag $TAG already exists; no new version on main"

read -rp "Publish $TAG from origin/main? [y/N] " ok
[[ $ok == y ]] || die "Cancelled"

git tag "$TAG" origin/main
git push origin "$TAG"
git merge --no-edit origin/main
git push origin dev
echo "$TAG published. GitHub Actions build running."
