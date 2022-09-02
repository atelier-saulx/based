#include <iostream>
#include <string>
#include <websocketpp/client.hpp>
#include <websocketpp/config/asio_no_tls_client.hpp>

#include "client.hpp"
#include "connection.hpp"

class HandlerStore {};

int main() {
    std::cout << "hello yes" << std::endl;

    BasedClient client("ws://localhost:9910");

    client.connect();

    int id = client.observe(
        "based_observe",
        [](std::string_view data, int checksum) { std::cout << data << std::endl; },
        "{$id: \"flurp\", $all: true}",
        [](std::string_view error) { std::cerr << error << std::endl; }, ObservableOpts(true, 100));

    std::cout << "OBS started, id = " << id << std::endl;

    while (true) {
    }
}