#!/bin/sh
set -e

BUILD_TYPE="Release" # Debug or Release

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
mkdir -p "$SCRIPT_DIR/build_ios_sim"

pushd "$SCRIPT_DIR/build_ios_sim"
cmake -G"Xcode" -DCMAKE_TOOLCHAIN_FILE=../iOS-simulator.cmake -DCMAKE_XCODE_ATTRIBUTE_DEVELOPMENT_TEAM="$XCODE_TEAMID" -S ../.. -B .
cmake --build . --config $BUILD_TYPE
popd