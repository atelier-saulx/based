#!/bin/sh

set -e

mkdir -p build_ios
pushd build_ios
cmake -G"Xcode" -DCMAKE_TOOLCHAIN_FILE=../ios_arm64.cmake -S .. -B .
cmake --build . --config Release
popd
