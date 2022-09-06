#include <iostream>
#include <string>
#include <websocketpp/client.hpp>
#include <websocketpp/config/asio_no_tls_client.hpp>

#include "client.hpp"
#include "connection.hpp"
#include "incoming.hpp"

class HandlerStore {};

int main() {
    std::cout << "hello yes" << std::endl;

    // Decoder dec;

    // unsigned char arr[4] = {112, 0, 0, 0};

    // std::string s(reinterpret_cast<char const*>(arr), 4);

    // int32_t res = dec.readUint8(s, 0, 4);
    // dec.getDataType(res);

    // std::cout << "res = " << res << ", 0x" << std::hex << res << std::endl;

    BasedClient client;

    client.connect("ws://localhost:9910");

    // int id = client.observe(
    //     "based_observe", "{$id: \"flurp\", $all: true}",
    //     [](std::string_view data, int checksum) { std::cout << data << std::endl; },
    //     [](std::string_view error) { std::cerr << error << std::endl; }, ObservableOpts(true,
    //     100));

    // std::cout << "OBS started, id = " << id << std::endl;

    client.function("small", "{\"hello\":\"yes\"}",
                    [](std::string_view data) { std::cout << "[RES] " << data << std::endl; });

    while (true) {
    }
}