#!/bin/sh

set -e

mkdir -p build_catalyst
pushd build_catalyst
cmake -G"Xcode" -DCMAKE_TOOLCHAIN_FILE=../Catalyst.cmake -S .. -B .
cmake --build . --config Release
popd
