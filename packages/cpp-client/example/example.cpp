#include <iostream>
#include <list>
#include <string>

#include <sstream>

#include "../distribute/based.hpp"

int main(int argc, char** argv) {
    // if (argc < 2) {
    //     std::cerr << "Specify address" << std::endl;
    //     return -1;
    // }

    int client1 = Based__new_client();
    int client2 = Based__new_client();

    Based__connect_to_url(client1, "ws://localhost:9910");
    Based__connect_to_url(client2, "ws://localhost:9910");
    bool done = false;
    int i = 0;
    std::string cmd;

    std::list<int> obs;

    while (!done) {
        // function("small", "", [](std::string_view data) {
        //     std::cout << "hello i received this data = " << data << std::endl;
        // });

        std::getline(std::cin, cmd);
        if (cmd == "q") {
            done = true;
            continue;
        }

        // auth("{\"b\":\"a\",\"a\":\"bababa\"}",
        //             [](std::string data) { std::cout << "got auth data = " << data << std::endl;
        //             });

        // get("counter", "", [](std::string data, std::string error) {
        //     std::cout << "I GOT data 2 = " << data << std::endl;
        // });

        if (cmd.substr(0, 1) == "r") {
            int rem_id = atoi(cmd.substr(2).c_str());
            Based__unobserve(client1, rem_id);
            obs.remove(rem_id);
            continue;
        }

        if (cmd.substr(0, 1) == "o") {
            i++;
            if (i % 2) {
                int id = Based__observe(client1, "chill", "",
                                        [](std::string data, int checksum, std::string error) {
                                            if (data.length() > 0) {
                                                std::cout << "DATA = " << data << std::endl;
                                            }
                                            if (error.length() > 0) {
                                                std::cout << "ERROR = " << data << std::endl;
                                            }
                                        });
                obs.push_back(id);
            } else {
                int id = Based__observe(client2, "chill", "",
                                        [](std::string data, int checksum, std::string error) {
                                            if (data.length() > 0) {
                                                std::cout << "DATA CLIENT 2= " << data << std::endl;
                                            }
                                            if (error.length() > 0) {
                                                std::cout << "ERROR = " << data << std::endl;
                                            }
                                        });
                obs.push_back(id);
            }
        }

        if (cmd.substr(0, 1) == "g") {
            Based__get(client1, "chill", "", [](std::string data, std::string error) {
                if (data.length() > 0) {
                    std::cout << "GET DATA = " << data << std::endl;
                }
                if (error.length() > 0) {
                    std::cout << "GET ERROR = " << data << std::endl;
                }
            });
        }

        if (cmd.substr(0, 1) == "f") {
            Based__function(client1, "chill", "", [](std::string data, std::string error) {
                if (data.length() > 0) {
                    std::cout << "FUNCTION DATA = " << data << std::endl;
                }
                if (error.length() > 0) {
                    std::cout << "FUNCTION ERROR = " << data << std::endl;
                }
            });
        }

        std::cout << "obs = ";
        for (auto el : obs) {
            std::cout << el << ", ";
        }
        std::cout << "\n";
        // if (i % 2 == 0) {
        //     int id = observe(
        //         "counter", "{\"b\":\"a\",\"a\":\"b\"}",
        //         [i](std::string_view data, int checksum) {
        //             std::cout << "counter n " << i << " data = " << data
        //                       << ", checksum = " << checksum << std::endl;
        //         },
        //         NULL, ObservableOpts(true, 100));
        //     std::cout << "> Added new counter observable, id = " << id << std::endl;
        //     i++;

        // } else {
        //     int id = observe(
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

    Based__delete_client(client1);
    Based__delete_client(client2);
    // disconnect();
}