#include <iostream>
#include <string>

#include <sstream>

#include "client.hpp"
// #include "connection.hpp"
// #include "incoming.hpp"

int main() {
    std::cout << "hello yes" << std::endl;

    // WsConnection endpoint;

    // endpoint.connect("ws://localhost:9001");

    // endpoint.sendText("hello");

    // bool done = false;
    // std::string input;

    // while (!done) {
    //     std::cout << "Enter Command: ";
    //     std::getline(std::cin, input);

    //     if (input == "quit") {
    //         done = true;
    //     } else if (input.substr(0, 4) == "send") {
    //         std::stringstream ss(input);

    //         std::string cmd;
    //         std::string message;

    //         ss >> cmd;
    //         std::getline(ss, message);

    //         endpoint.sendText(message);
    //     } else {
    //         std::cout << "> Unrecognized Command" << std::endl;
    //     }
    // }

    // return 0;

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

    client.function("small", "{\"amICpp\":\"yes\"}",
                    [](std::string_view data) { std::cout << "[POOP] " << data << std::endl; });

    std::cin.get();
    // client.disconnect();
}