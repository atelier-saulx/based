#include <iostream>
#include <list>
#include <string>

#include <sstream>

#include "based.h"

void based_cb(const char* data, const char* error) {
    int len_data = strlen(data);
    int len_error = strlen(error);
    if (len_data > 0) {
        std::cout << "DATA = " << data << std::endl;
    }
    if (len_error > 0) {
        std::cout << "ERROR = " << error << std::endl;
    }
}

void based_observe_cb(const char* data, uint64_t checksum, const char* error) {
    int len_data = strlen(data);
    int len_error = strlen(error);
    if (len_data > 0) {
        std::cout << "DATA[" << checksum << "] = " << data << std::endl;
    }
    if (len_error > 0) {
        std::cout << "ERROR = " << error << std::endl;
    }
}

int main(int argc, char** argv) {
    // if (argc < 2) {
    //     std::cerr << "Specify address" << std::endl;
    //     return -1;
    // }

    int client1 = Based__new_client();

    // Based__connect_to_url(client1, (char*)"wss://localhost:9910");
    Based__connect(client1, "https://d15p61sp2f2oaj.cloudfront.net/", "airhub", "airhub", "edge",
                   "@based/edge", "", false);
    bool done = false;
    // int i = 0;
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

        if (cmd.substr(0, 1) == "r") {
            int rem_id = atoi(cmd.substr(2).c_str());
            Based__unobserve(client1, rem_id);
            obs.remove(rem_id);
            continue;
        }

        if (cmd.substr(0, 1) == "o") {
            std::string fn_name = cmd.substr(2);

            std::cout << "Observing " << fn_name << std::endl;

            char* fn = &*fn_name.begin();
            int id = Based__observe(client1, fn, (char*)"", &based_observe_cb);
            obs.push_back(id);
        }

        if (cmd.substr(0, 1) == "f") {
            std::string fn_name = cmd.substr(2);
            std::cout << "Function " << fn_name << std::endl;
            char* fn = &*fn_name.begin();
            Based__function(client1, fn, (char*)"", &based_cb);
        }

        if (cmd.substr(0, 1) == "d") {
            Based__disconnect(client1);
        }

        if (cmd.substr(0, 1) == "c") {
            // Based__connect(client1, "http://localhost:7022", "saulx", "demo", "production",
            //                "@based/edge", "", false);
            std::cout << "Doing nothing" << std::endl;
            // Based__connect_to_url(client1, (char*)"wss://localhost:9910");
        }

        if (cmd.substr(0, 1) == "a") {
            Based__auth(client1, "flurp", NULL);
        }

        std::cout << "obs = ";
        for (auto el : obs) {
            std::cout << el << ", ";
        }
        std::cout << "\n";
    }

    Based__delete_client(client1);
    // disconnect();
}