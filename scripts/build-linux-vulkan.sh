#!/usr/bin/env bash
# build-linux-vulkan.sh
# Builds whisper-cli with Vulkan inside Ubuntu 24.04 (glibc 2.39), so it runs on
# the same distros as the app, and installs it as a Tauri sidecar:
#   src-tauri/binaries/whisper-cli-vulkan-x86_64-unknown-linux-gnu
#
# Usage:
#   scripts/build-linux-vulkan.sh
#
# Env overrides:
#   WHISPER_VERSION  whisper.cpp tag            (default: v1.8.5)
#   DOCKER           container command          (default: docker; e.g. "sudo docker" or podman)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN_DIR="$ROOT/src-tauri/binaries"
OUT_NAME="whisper-cli-vulkan-x86_64-unknown-linux-gnu"
WHISPER_VERSION="${WHISPER_VERSION:-v1.8.5}"
DOCKER="${DOCKER:-docker}"
IMAGE="ubuntu:24.04"
MAX_GLIBC="2.39"   # what the app binary already requires

log() { printf '[vulkan-build] %s\n' "$*"; }
die() { printf '[vulkan-build] ERROR: %s\n' "$*" >&2; exit 1; }

# shellcheck disable=SC2086
$DOCKER info >/dev/null 2>&1 \
  || die "'$DOCKER' is not usable. Try: DOCKER=\"sudo docker\" $0"

log "building whisper.cpp $WHISPER_VERSION with Vulkan in $IMAGE (several minutes)"
# shellcheck disable=SC2086
$DOCKER run --rm \
  -v "$BIN_DIR:/out" \
  -e WHISPER_VERSION="$WHISPER_VERSION" \
  -e OUT_NAME="$OUT_NAME" \
  -e HOST_UID="$(id -u)" \
  -e HOST_GID="$(id -g)" \
  "$IMAGE" bash -euo pipefail -c '
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get install -y -qq --no-install-recommends \
      build-essential cmake git ca-certificates libvulkan-dev glslc spirv-headers >/dev/null
    git clone --quiet --depth 1 --branch "$WHISPER_VERSION" https://github.com/ggml-org/whisper.cpp /src
    cmake -S /src -B /build \
      -DCMAKE_BUILD_TYPE=Release \
      -DGGML_VULKAN=ON \
      -DGGML_NATIVE=OFF \
      -DBUILD_SHARED_LIBS=OFF \
      -DWHISPER_BUILD_TESTS=OFF
    cmake --build /build -j"$(nproc)" --target whisper-cli
    strip --strip-unneeded /build/bin/whisper-cli
    install -m 755 /build/bin/whisper-cli "/out/$OUT_NAME"
    chown "$HOST_UID:$HOST_GID" "/out/$OUT_NAME"
  '

OUT="$BIN_DIR/$OUT_NAME"
[[ -x "$OUT" ]] || die "binary not produced: $OUT"

glibc="$(objdump -T "$OUT" | grep -o 'GLIBC_[0-9.]*' | sed 's/GLIBC_//' | sort -uV | tail -1)"
if [[ "$(printf '%s\n%s\n' "$glibc" "$MAX_GLIBC" | sort -V | tail -1)" != "$MAX_GLIBC" ]]; then
  die "binary requires glibc $glibc (> $MAX_GLIBC)"
fi

log "ok: $OUT"
log "size: $(du -h "$OUT" | cut -f1) · requires glibc $glibc"
log "dynamic deps: $(readelf -d "$OUT" | sed -n 's/.*Shared library: \[\(.*\)\]/\1/p' | tr '\n' ' ')"
