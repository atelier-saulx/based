
cmake_minimum_required(VERSION 3.20.0)

project(based)

include_directories(lib/websocketpp)
include_directories(lib/zlib)
include_directories(lib/nlohmann-json)
include_directories(lib/apply-patch)
include_directories(lib/asio/asio/include)
include_directories(/usr/local/opt/openssl@3/include)
link_directories(/usr/local/opt/openssl@3/lib) # This is how CMake does -L[...]


set (CMAKE_CXX_STANDARD 11)
set(CMAKE_VERBOSE_MAKEFILE on)


add_library(based STATIC
src/based.cpp
src/connection.cpp
src/basedclient.cpp
src/utility.cpp
)

add_executable(linked-example example/example.cpp)

add_compile_definitions(ASIO_STANDALONE _WEBSOCKETPP_CPP11_STL_ BASED_TLS)

# target_link_libraries(linked-example LINK_PUBLIC )
target_link_libraries(linked-example PRIVATE based)

target_link_libraries(based PRIVATE z)
target_link_libraries(based PRIVATE curl)
target_link_libraries(based PRIVATE ssl)
target_link_libraries(based PRIVATE crypto)


target_include_directories(linked-example PRIVATE src)

