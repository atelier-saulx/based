#!/bin/sh

set -e

mkdir -p build_ios
pushd build_ios
cmake -G"Xcode" -DCMAKE_TOOLCHAIN_FILE=../iOS.cmake -S .. -B .
cmake --build . --config Release
popd
