#include <iostream>
#include <string>

#include <sstream>

#include "client.hpp"

int main() {
    BasedClient client;

    client.connect("ws://localhost:9910");

    bool done = false;
    int i = 0;
    std::string cmd;

    while (!done) {
        // client.function("small", "", [](std::string_view data) {
        //     std::cout << "hello i received this data = " << data << std::endl;
        // });

        std::getline(std::cin, cmd);
        if (cmd == "q") done = true;
        if (cmd.substr(0, 1) == "r") {
            int rem_id = atoi(cmd.substr(2).c_str());
            client.unobserve(rem_id);
            continue;
        }
        if (i % 2 == 0) {
            int id = client.observe(
                "counter", "{\"b\":\"a\",\"a\":\"b\"}",
                [i](std::string_view data, int checksum) {
                    std::cout << "counter n " << i << " data = " << data
                              << ", checksum = " << checksum << std::endl;
                },
                NULL, ObservableOpts(true, 100));
            std::cout << "> Added new counter observable, id = " << id << std::endl;
            i++;

        } else {
            int id = client.observe(
                "counterPlus", "{\"b\":\"a\",\"a\":\"b\"}",
                [i](std::string_view data, int checksum) {
                    std::cout << "counterPlus n " << i << " data = " << data
                              << ", checksum = " << checksum << std::endl;
                },
                NULL, ObservableOpts(true, 100));
            std::cout << "> Added new counterPlus observable, id = " << id << std::endl;
            i++;
        }
    }
    // client.disconnect();
}