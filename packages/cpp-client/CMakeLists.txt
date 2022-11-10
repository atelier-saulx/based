
cmake_minimum_required(VERSION 3.20.0)

project(based)

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


target_link_directories(based PRIVATE /usr/local/opt/openssl@3/lib) # This is how CMake does -L[...]
target_link_directories(based PRIVATE lib/curl/artifacts/lib)

target_link_libraries(linked-example LINK_PUBLIC )
target_link_libraries(linked-example PRIVATE based)

target_link_libraries(based PRIVATE z)
target_link_libraries(based PRIVATE curl)
target_link_libraries(based PRIVATE ssl)
target_link_libraries(based PRIVATE crypto)


target_include_directories(linked-example PRIVATE src)

target_include_directories(based PRIVATE lib/websocketpp)
target_include_directories(based PRIVATE lib/zlib)
target_include_directories(based PRIVATE lib/nlohmann-json)
target_include_directories(based PRIVATE lib/apply-patch)
target_include_directories(based PRIVATE lib/curl/artifacts/include)
target_include_directories(based PRIVATE lib/asio/asio/include)
target_include_directories(based PRIVATE /usr/local/opt/openssl@3/include)

