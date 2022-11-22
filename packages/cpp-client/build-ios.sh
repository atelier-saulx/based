#!/bin/sh

set -e

BUILD_TYPE="Release" # Debug or Release


mkdir -p build_ios
pushd build_ios
cmake -G"Xcode" -DCMAKE_TOOLCHAIN_FILE=../iOS.cmake -S .. -B .
cmake --build . --config $BUILD_TYPE
popd
