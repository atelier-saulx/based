# Release 7.84.0 Library and Headers

This release includes cURL, OpenSSL and Nghttp2 libraries and header files for MacOS, Mac Catalyst, iOS and tvOS projects.

## Build Command

    ./build.sh 

## Versions

    LIBCURL="7.84.0"        # https://curl.haxx.se/download.html
    OPENSSL="1.1.1p"        # https://www.openssl.org/source/
    NGHTTP2="1.48.0"        # https://nghttp2.org/

## Archive

This directory contains the curl and openssl headers (in the `include` folder), the *.a libraries and XCFrameworks along with MacOS executable binaries for `curl` and `openssl` (intel x86_64 and Apple silicon arm64).

    |__libcurl-7.84.0-openssl-1.1.1p-nghttp2-1.48.0
        |
        |__ bin/
        │   |__ curl*  (universal binary)
        │   |__ curl-arm64*
        │   |__ curl-x86_64*
        │   |__ openssl*  (universal binary)
        │   |__ openssl-arm64*
        │   |__ openssl-x86_64*
        |
        |__ cacert.pem
        |
        |__ include/
        │   |__ curl/
        │   |__ openssl/
        |
        |__ lib/
        │   |__ Catalyst/
        │   |__ MacOS/
        │   |__ iOS/
        │   |__ iOS-fat/
        │   |__ iOS-simulator/
        │   |__ tvOS/
        │   |__ tvOS-simulator/
        |
        |__ xcframework/
            |__ libcrypto.xcframework/
            │   |__ ios-arm64_arm64e_armv7_armv7s/
            │   |__ ios-arm64_i386_x86_64-simulator/
            │   |__ tvos-arm64/
            │   |__ tvos-arm64_x86_64-simulator/
            |__ libcurl.xcframework/
            │   |__ ios-arm64_arm64e_armv7_armv7s/
            │   |__ ios-arm64_i386_x86_64-simulator/
            │   |__ tvos-arm64/
            │   |__ tvos-arm64_x86_64-simulator/
            |__ libnghttp2.xcframework/
            │   |__ ios-arm64_arm64e_armv7_armv7s/
            │   |__ ios-arm64_i386_x86_64-simulator/
            │   |__ tvos-arm64/
            │   |__ tvos-arm64_x86_64-simulator/
            |__ libssl.xcframework/
                |__ ios-arm64_arm64e_armv7_armv7s/
                |__ ios-arm64_i386_x86_64-simulator/
                |__ tvos-arm64/
                |__ tvos-arm64_x86_64-simulator/

## Usage

 1. Copy headers to your project.
 2. Import appropriate libraries: "libssl.a", "libcrypto.a", "libcurl.a", "libnghttp2.a" *or*
    **XCFrameworks Alternative**: Import appropriate *xcframework* folders into your project in Xcode.
 3. Reference Headers.
 4. Specifying the flag  "-lz" in "Other Linker Flags" (OTHER_LDFLAGS) setting in the "Linking" section in the Build settings of the target.
 5. Initialize curl in your code:

        #include <curl/curl.h>

        - (void)foo {    
            CURL* cURL = curl_easy_init();  
            ...  
        }