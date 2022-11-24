#!/bin/sh

set -e

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
mkdir -p "$SCRIPT_DIR/build_catalyst"

echo "??????>>>>>>>>>>>>>>>>>>>>>" "$XCODE_TEAMID"

pushd "$SCRIPT_DIR/build_catalyst"
cmake -G"Xcode" -DCMAKE_TOOLCHAIN_FILE=../Catalyst.cmake -DCMAKE_XCODE_ATTRIBUTE_DEVELOPMENT_TEAM="$XCODE_TEAMID" -S ../.. -B .
cmake --build . --config Release
popd
