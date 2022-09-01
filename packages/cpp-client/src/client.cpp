#include <iostream>
#include <map>
#include <string>
#include <websocketpp/client.hpp>
#include <websocketpp/config/asio_no_tls_client.hpp>

typedef websocketpp::client<websocketpp::config::asio_client> ws_client;

enum ConnectionStatus { OPEN = 0, CONNECTING, CLOSED, FAILED };

struct ObservableOpts {
    ObservableOpts(bool ls, int mct) : local_storage(ls), max_cache_time(mct){};

    bool local_storage;
    int max_cache_time;
};

class HandlerStore {};

class WsConnection {
   public:
    WsConnection(std::string_view uri) {
        // set the endpoint logging behavior to silent by clearing all of the access and error
        // logging channels
        m_ws.clear_access_channels(websocketpp::log::alevel::all);
        m_ws.clear_error_channels(websocketpp::log::elevel::all);

        m_ws.init_asio();
        // perpetual mode the endpoint's processing loop will not exit automatically when it has no
        // connections
        m_ws.start_perpetual();

        // run perpetually in a thread
        m_thread = websocketpp::lib::make_shared<websocketpp::lib::thread>(&ws_client::run, &m_ws);
    };
    ~WsConnection() {
        m_ws.stop_perpetual();

        if (m_status == ConnectionStatus::OPEN) {
            // Only close open connections
            std::cout << "> Closing connection" << std::endl;

            websocketpp::lib::error_code ec;
            m_ws.close(m_con->get_handle(), websocketpp::close::status::going_away, "", ec);
            if (ec) {
                std::cout << "> Error closing connection: " << ec.message() << std::endl;
            }
        }

        m_thread->join();
    };
    int connect(std::string const& uri) {
        websocketpp::lib::error_code ec;

        // create connection request to uri
        ws_client::connection_ptr con = m_ws.get_connection(uri, ec);

        if (ec) {
            std::cout << "> Connect initialization error: " << ec.message() << std::endl;
            return -1;
        }

        m_con = con;

        // bind must be used if the function we're binding to doest have the right number of
        // arguments (hence the placeholders) these handlers must be set before calling connect, and
        // can't be changed after (i think)
        con->set_message_handler([](websocketpp::connection_hdl hdl, ws_client::message_ptr msg) {
            if (msg->get_opcode() == websocketpp::frame::opcode::text) {
                std::cout << "[MSG::TEXT] " << msg->get_payload() << std::endl;
            } else {
                std::cout << "[MSG::HEX]" << websocketpp::utility::to_hex(msg->get_payload())
                          << std::endl;
            }
        });

        m_ws.connect(con);
    };
    void disconnect(){};
    void send(std::string_view message){};

   private:
    ws_client m_ws;
    ConnectionStatus m_status;
    ws_client::connection_ptr m_con;
    websocketpp::lib::shared_ptr<websocketpp::lib::thread> m_thread;
    HandlerStore m_store;
};

class BasedClient {
   public:
    BasedClient(std::string_view uri) : m_connection(uri) {}

    void connect(std::string_view uri) {}

    /**
     * Observe a function. This returns the observe ID used to
     * unsubscribe with .unobserve
     */
    int observe(std::string name,
                void (*onData)(std::string_view /*data*/, int /*checksum*/),
                std::string_view payload,
                void (*onError)(std::string_view /*error*/),
                ObservableOpts obs_opts) {}

    void unobserve(int id){};

    void function(void (*cb)(std::string_view name, std::string_view payload)) {}

    void get() {}

    void auth(std::string token) {}

   private:
    WsConnection m_connection;
};

int main() {
    std::cout << "hello yes" << std::endl;

    BasedClient client("ws://localhost:9101");

    client.observe(
        "based_observe",
        [](std::string_view data, int checksum) { std::cout << data << std::endl; },
        "{$id: \"flurp\", $all: true}",
        [](std::string_view error) { std::cerr << error << std::endl; }, ObservableOpts(true, 100));
}