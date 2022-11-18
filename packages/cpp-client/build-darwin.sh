#!/bin/sh

set -e

mkdir -p build_darwin
pushd build_darwin
cmake -G"Xcode" -DCMAKE_TOOLCHAIN_FILE=../MacOS.cmake -S .. -B .
cmake --build . --config Release
popd
