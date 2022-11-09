#!/bin/sh

set -e

mkdir -p build_darwin
pushd build_darwin
cmake -G"Xcode" -DCMAKE_TOOLCHAIN_FILE=../darwin_x64.cmake -S .. -B .
cmake --build . --config Release
popd
