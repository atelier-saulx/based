#!/bin/sh
set -e

BUILD_TYPE="Release" # Debug or Release


mkdir -p build_ios_sim
pushd build_ios_sim
cmake -G"Xcode" -DCMAKE_TOOLCHAIN_FILE=../iOS-simulator.cmake -S .. -B .
cmake --build . --config $BUILD_TYPE
