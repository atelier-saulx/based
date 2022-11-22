#!/bin/sh

set -e

BUILD_TYPE="Release" # Debug or Release

mkdir -p build_darwin
pushd build_darwin
cmake -G"Xcode" -DCMAKE_TOOLCHAIN_FILE=../MacOS.cmake -S .. -B .
cmake --build . --config $BUILD_TYPE
popd
