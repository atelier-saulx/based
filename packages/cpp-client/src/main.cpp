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

    // std::cout << "OBS started, id = " << id << std::endl;
    bool done = false;
    int i = 0;
    std::string cmd;

    while (!done) {
        // client.function("small", "", [](std::string_view data) {
        //     std::cout << "hello i received this data = " << data << std::endl;
        // });
        int id = client.observe(
            "counter", "{\"b\":\"a\",\"a\":\"b\"}",
            [i](std::string_view data, int checksum) {
                std::cout << "observable n " << i << " data = " << data
                          << ", checksum = " << checksum << std::endl;
            },
            [](std::string_view error) { std::cerr << "obs error" << error << std::endl; },
            ObservableOpts(true, 100));
        i++;
        std::getline(std::cin, cmd);
        if (cmd == "q") done = true;
    }
    // client.disconnect();
}