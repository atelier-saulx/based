
cmake_minimum_required(VERSION 3.20.0)

project(universal-based)

include_directories(lib/websocketpp)
include_directories(lib/zlib)
include_directories(lib/nlohmann-json)
include_directories(lib/apply-patch)
include_directories(lib/asio/asio/include)
include_directories(prebuilt-libs/openssl/include/)
include_directories(prebuilt-libs/curl/include/)

if(NOT DEFINED ARCH_FOLDER)
  message(FATAL_ERROR "ARCH_FOLDER is not set, I don't know where to look for libraries")
endif(NOT DEFINED ARCH_FOLDER)


find_library(CURL_LIBRARY NO_CACHE REQUIRED NO_DEFAULT_PATH NAMES libcurl.dylib HINTS "prebuilt-libs/curl/lib/${ARCH_FOLDER}")
find_library(SSL_LIBRARY NO_CACHE REQUIRED NO_DEFAULT_PATH NAMES libssl.a HINTS "prebuilt-libs/openssl/lib/${ARCH_FOLDER}")
find_library(CRYPTO_LIBRARY NO_CACHE REQUIRED NO_DEFAULT_PATH NAMES libcrypto.a HINTS "prebuilt-libs/openssl/lib/${ARCH_FOLDER}")


set (CMAKE_CXX_STANDARD 11)
set(CMAKE_VERBOSE_MAKEFILE on)


add_library(based SHARED
src/based.cpp
src/connection.cpp
src/basedclient.cpp
src/utility.cpp
)

add_executable(linked-example example/example.cpp)

add_compile_definitions(ASIO_STANDALONE _WEBSOCKETPP_CPP11_STL_ BASED_TLS)

target_link_libraries(linked-example PRIVATE based)

target_link_libraries(based PRIVATE z)
target_link_libraries(based PRIVATE ${CURL_LIBRARY})
target_link_libraries(based PRIVATE ${SSL_LIBRARY})
target_link_libraries(based PRIVATE ${CRYPTO_LIBRARY})

target_include_directories(linked-example PRIVATE src)
