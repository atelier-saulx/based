#!/bin/sh

# Mac OS
mkdir -p build_darwin
pushd build_darwin
cmake -G"Xcode" -DCMAKE_TOOLCHAIN_FILE=../darwin_x64.cmake -S .. -B .
cmake --build . --config Release
popd

# Ios
mkdir -p build_ios
pushd build_ios
cmake -G"Xcode" -DCMAKE_TOOLCHAIN_FILE=../ios_arm64.cmake -S .. -B .
cmake --build . --config Release
popd
