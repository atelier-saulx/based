#!/bin/sh

set -e

mkdir -p build_ios_sim
pushd build_ios_sim
cmake -G"Xcode" -DCMAKE_TOOLCHAIN_FILE=../ios_sim_arm64.cmake -S .. -B .
cmake --build . --config Release
popd
