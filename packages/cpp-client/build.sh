#!/bin/bash

if [ $# -eq 0 ]; then
 echo "specify teamID as first argument"
 exit 1
fi

shopt -s nullglob
for file in build-scripts/*.sh
do
  echo Executing "$file"
  export XCODE_TEAMID="$1"
  /bin/bash "$file"
done
shopt -u nullglob


xcodebuild -create-xcframework -library build-scripts/build_catalyst/Release/libbased.dylib -headers include -library build-scripts/build_darwin/Release/libbased.dylib -headers include -library build-scripts/build_ios/Release-iphoneos/libbased.dylib -headers include -library build-scripts/build_ios_sim/Release-iphonesimulator/libbased.dylib -headers include  -output Based.xcframework