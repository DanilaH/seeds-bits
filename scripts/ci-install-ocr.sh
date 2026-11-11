#!/usr/bin/env bash
# CI-only OCR. Pinned upstream sources avoid unreliable Ubuntu package mirrors.
# The resulting tools are never included in an application payload.
set -euo pipefail
seeds_sources="${SEEDS_OCR_SOURCES:-.ci-ocr}"
seeds_prefix="${RUNNER_TEMP:?CI RUNNER_TEMP is required}/seeds-ocr"
seeds_build="$RUNNER_TEMP/seeds-ocr-build"
mkdir -p "$seeds_prefix/share/tessdata" test-results/ci-packages
test "$(git -C "$seeds_sources/tesseract" rev-parse HEAD)" = 7e548e6eff172f38f97664afe7f7ce40db36c8d6
test "$(git -C "$seeds_sources/leptonica" rev-parse HEAD)" = 13275a278eb55b5746e33f95fbf5a2c8f604b3ab
test "$(git -C "$seeds_sources/tessdata" rev-parse HEAD)" = 87416418657359cb625c412a48b6e1d6d41c29bd
echo 'All three OCR source commits verified.'
# Native screenshots stay PNG; the reader supplies lossless RGB PNM to OCR.
# PNM is built into Leptonica, so no image codec development packages are needed.
cmake -S "$seeds_sources/leptonica" -B "$seeds_build/leptonica" -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX="$seeds_prefix" -DCMAKE_INSTALL_LIBDIR=lib -DBUILD_SHARED_LIBS=OFF -DBUILD_PROG=OFF -DENABLE_PNG=OFF -DENABLE_ZLIB=OFF -DENABLE_GIF=OFF -DENABLE_JPEG=OFF -DENABLE_TIFF=OFF -DENABLE_WEBP=OFF -DENABLE_OPENJPEG=OFF
cmake --build "$seeds_build/leptonica" --parallel 2
cmake --install "$seeds_build/leptonica"
cmake -S "$seeds_sources/tesseract" -B "$seeds_build/tesseract" -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX="$seeds_prefix" -DCMAKE_INSTALL_LIBDIR=lib -DLeptonica_DIR="$seeds_prefix/lib/cmake/leptonica" -DBUILD_SHARED_LIBS=OFF -DBUILD_TRAINING_TOOLS=OFF -DBUILD_TESTS=OFF -DDISABLE_ARCHIVE=ON -DDISABLE_CURL=ON -DDISABLE_TIFF=ON -DGRAPHICS_DISABLED=ON -DOPENMP_BUILD=OFF
cmake --build "$seeds_build/tesseract" --parallel 2
cmake --install "$seeds_build/tesseract"
cp "$seeds_sources/tessdata/rus.traineddata" "$seeds_prefix/share/tessdata/"
export TESSDATA_PREFIX="$seeds_prefix/share/tessdata"
"$seeds_prefix/bin/tesseract" --list-langs | grep -Fx rus
echo "$seeds_prefix/bin" >> "$GITHUB_PATH"
echo "TESSDATA_PREFIX=$TESSDATA_PREFIX" >> "$GITHUB_ENV"
echo 'SEEDS_OCR_PNM=1' >> "$GITHUB_ENV"
SEEDS_OCR_PREFIX="$seeds_prefix" python3 - <<'PY'
import hashlib,json,os,pathlib,subprocess
prefix=pathlib.Path(os.environ['SEEDS_OCR_PREFIX'])
data={'method':'Official pinned sources; no apt dependency, no app installation yet','tesseract':{'version':'5.5.4','commit':'7e548e6eff172f38f97664afe7f7ce40db36c8d6'},'leptonica':{'version':'1.87.0','commit':'13275a278eb55b5746e33f95fbf5a2c8f604b3ab'},'tessdata_fast':{'commit':'87416418657359cb625c412a48b6e1d6d41c29bd','rus_sha256':hashlib.sha256((prefix/'share/tessdata/rus.traineddata').read_bytes()).hexdigest()},'runtimeVersion':subprocess.check_output([str(prefix/'bin/tesseract'),'--version'],text=True).splitlines()[0],'binary_sha256':hashlib.sha256((prefix/'bin/tesseract').read_bytes()).hexdigest(),'shippedInApk':False}
pathlib.Path('test-results/ci-packages/ocr.json').write_text(json.dumps(data,indent=2)+'\n')
print(json.dumps(data))
PY
