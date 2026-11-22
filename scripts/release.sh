#!/usr/bin/env bash
# Usage: scripts/release.sh X.Y.Z  (dev branch, before the release PR to main)
set -euo pipefail
cd "$(dirname "$0")/.."

die() { echo "$1" >&2; exit 1; }

VERSION="${1:?Usage: $0 X.Y.Z}"
TAG="v$VERSION"

[[ $VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$ ]] || die "Invalid version: $VERSION"
[[ $(git branch --show-current) == dev ]] || die "Must run on the dev branch"
[[ -z $(git status --porcelain -uno) ]] || die "Working tree has uncommitted changes"
git fetch --tags --quiet
git rev-parse -q --verify "refs/tags/$TAG" >/dev/null && die "Tag $TAG already exists"

sed -i -E "0,/\"version\": \"[^\"]+\"/s//\"version\": \"$VERSION\"/" package.json
sed -i -E "0,/\"version\": \"[^\"]+\"/s//\"version\": \"$VERSION\"/" src-tauri/tauri.conf.json
sed -i -E "0,/^version = \"[^\"]+\"/s//version = \"$VERSION\"/" src-tauri/Cargo.toml
cargo update --workspace --offline --quiet --manifest-path src-tauri/Cargo.toml

git cliff --unreleased --tag "$TAG" --prepend CHANGELOG.md
"${EDITOR:-vim}" CHANGELOG.md

read -rp "Commit bump $TAG? [y/N] " ok
[[ $ok == y ]] || die "Cancelled. Changes left uncommitted."

git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock CHANGELOG.md
git commit -m "bump $TAG"
echo "Bump $TAG committed. Next: PR dev → main, then scripts/publish.sh."
