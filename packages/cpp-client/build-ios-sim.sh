#!/bin/sh
set -e

BUILD_TYPE="Debug" # Debug or Release


mkdir -p build_ios_sim
pushd build_ios_sim
cmake -G"Xcode" -DCMAKE_TOOLCHAIN_FILE=../iOS-simulator.cmake -S .. -B .
cmake --build . --config $BUILD_TYPE
# pushd "${BUILD_TYPE}-iphonesimulator"
# mkdir -p lib
# pushd lib
# cp ../../../prebuilt-libs/curl/lib/ios-sim-x86_64/libcurl.dylib ./libcurl.dylb
# cp ../../../prebuilt-libs/curl/lib/ios-sim-x86_64/libcurl.4.dylib ./libcurl.4.dylb
# cp ../../../prebuilt-libs/openssl/lib/ios-sim-x86_64/libssl.a ./libssl.a
# cp ../../../prebuilt-libs/openssl/lib/ios-sim-x86_64/libcrypto.a ./libcrypto.a
# popd
