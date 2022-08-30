#include <iostream>
#include <map>
#include <string>
#include <websocketpp/client.hpp>
#include <websocketpp/config/asio_no_tls_client.hpp>

typedef websocketpp::client<websocketpp::config::asio_client> client_t;

struct ObservableOpts {
    bool local_storage;
    int max_cache_time;
};

class WebSocketConnection {
   public:
    typedef websocketpp::lib::shared_ptr<WebSocketConnection> ptr;

    WebSocketConnection(int id, websocketpp::connection_hdl hdl, std::string uri)
        : m_id(id),
          m_hdl(hdl),
          m_status("Connecting"),
          m_uri(uri),
          m_server("N/A") {}

    void on_open(client_t* c, websocketpp::connection_hdl hdl) {
        m_status = "Open";

        client_t::connection_ptr con = c->get_con_from_hdl(hdl);
        m_server = con->get_response_header("Server");
    }

    void on_fail(client_t* c, websocketpp::connection_hdl hdl) {
        m_status = "Failed";

        client_t::connection_ptr con = c->get_con_from_hdl(hdl);
        m_server = con->get_response_header("Server");
        m_error_reason = con->get_ec().message();
    }

    void on_close(client_t* c, websocketpp::connection_hdl hdl) {
        m_status = "Closed";
        client_t::connection_ptr con = c->get_con_from_hdl(hdl);
        std::stringstream s;
        s << "close code: " << con->get_remote_close_code() << " ("
          << websocketpp::close::status::get_string(con->get_remote_close_code())
          << "), close reason: " << con->get_remote_close_reason();
        m_error_reason = s.str();
    }

    void on_message(websocketpp::connection_hdl, client_t::message_ptr msg) {
        if (msg->get_opcode() == websocketpp::frame::opcode::text) {
            std::cout << ">> " << msg->get_payload() << std::endl;
            m_messages.push_back("<< " + msg->get_payload());
        } else {
            std::cout << "received non-text message" << std::endl;
            m_messages.push_back("<< " + websocketpp::utility::to_hex(msg->get_payload()));
        }
    }

    websocketpp::connection_hdl get_hdl() const {
        return m_hdl;
    }

    int get_id() const {
        return m_id;
    }

    std::string get_status() const {
        return m_status;
    }

    void record_sent_message(std::string message) {
        m_messages.push_back(">> " + message);
    }

    friend std::ostream& operator<<(std::ostream& out, WebSocketConnection const& data);

   private:
    int m_id;
    websocketpp::connection_hdl m_hdl;
    std::string m_status;
    std::string m_uri;
    std::string m_server;
    std::string m_error_reason;
    std::vector<std::string> m_messages;
};

class BasedClient {
   public:
    void connect() {}

    // TODO: check if this is true:
    // std::string_view seems to be a good way to handle  the "any" type from js.
    void observe(std::string name,
                 void (*onData)(std::string_view /*data*/, int /*checksum*/),
                 std::string_view payload,
                 void (*onError)(std::string_view /*error*/),
                 ObservableOpts obs_opts) {}

    void function() {}

    void get() {}

    void auth(std::string token) {}

   private:
    client_t ws;
};

int main() {
    std::cout << "hello yes" << std::endl;
}