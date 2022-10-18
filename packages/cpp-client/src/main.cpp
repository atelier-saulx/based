#include <iostream>
#include <string>
#include <vector>

#include <sstream>

#include "client.hpp"

int main(int argc, char** argv) {
    // if (argc < 2) {
    //     std::cerr << "Specify address" << std::endl;
    //     return -1;
    // }

    BasedClient client;
    client.connect("https://d15p61sp2f2oaj.cloudfront.net", "saulx", "demo", "production",
                   "@based/hub", "", false);

    bool done = false;
    // int i = 0;
    std::string cmd;

    std::vector<int> obs;

    while (!done) {
        // client.function("small", "", [](std::string_view data) {
        //     std::cout << "hello i received this data = " << data << std::endl;
        // });

        std::getline(std::cin, cmd);
        if (cmd == "q") {
            done = true;
            continue;
        }

        // client.auth("{\"b\":\"a\",\"a\":\"bababa\"}",
        //             [](std::string data) { std::cout << "got auth data = " << data << std::endl;
        //             });

        // client.get("counter", "", [](std::string data, std::string error) {
        //     std::cout << "I GOT data 2 = " << data << std::endl;
        // });

        if (cmd.substr(0, 1) == "r") {
            int rem_id = atoi(cmd.substr(2).c_str());
            client.unobserve(rem_id);
            continue;
        }

        if (cmd.substr(0, 1) == "o") {
            int id = client.observe(
                "counter", "{\"b\":\"a\",\"a\":\"bababa\"}",
                [](std::string data, int checksum, std::string error) {
                    if (data.length() > 0) {
                        std::cout << "DATA = " << data << std::endl;
                    }
                    if (error.length() > 0) {
                        std::cout << "ERROR = " << data << std::endl;
                    }
                },
                ObservableOpts(true, 100));
            obs.push_back(id);
        }

        std::cout << "obs = ";
        for (auto el : obs) {
            std::cout << el << ", ";
        }
        std::cout << "\n";
        // if (i % 2 == 0) {
        //     int id = client.observe(
        //         "counter", "{\"b\":\"a\",\"a\":\"b\"}",
        //         [i](std::string_view data, int checksum) {
        //             std::cout << "counter n " << i << " data = " << data
        //                       << ", checksum = " << checksum << std::endl;
        //         },
        //         NULL, ObservableOpts(true, 100));
        //     std::cout << "> Added new counter observable, id = " << id << std::endl;
        //     i++;

        // } else {
        //     int id = client.observe(
        //         "counterPlus", "{\"b\":\"a\",\"a\":\"b\"}",
        //         [i](std::string_view data, int checksum) {
        //             std::cout << "counterPlus n " << i << " data = " << data
        //                       << ", checksum = " << checksum << std::endl;
        //         },
        //         NULL, ObservableOpts(true, 100));
        //     std::cout << "> Added new counterPlus observable, id = " << id << std::endl;
        //     i++;
        // }
    }
    // client.disconnect();
}