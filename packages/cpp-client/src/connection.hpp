#ifndef BASED_WS_CONNECTION_H
#define BASED_WS_CONNECTION_H

#include <iostream>
#include <string>
#include <thread>
#include <websocketpp/client.hpp>

#ifdef BASED_TLS
#include <websocketpp/config/asio_client.hpp>                                 // SSL
typedef websocketpp::client<websocketpp::config::asio_tls_client> ws_client;  // SSL
#endif
#ifndef BASED_TLS
#include <websocketpp/config/asio_no_tls_client.hpp>                      // No SSL
typedef websocketpp::client<websocketpp::config::asio_client> ws_client;  // No SSL
#endif

enum ConnectionStatus { OPEN = 0, CONNECTING, CLOSED, FAILED };

class WsConnection {
    // eventually there should be some logic here to handle inactivity.
   public:
    WsConnection();
    ~WsConnection();
    int connect(std::string uri);
    void disconnect();
    void set_open_handler(std::function<void()> on_open);
    void set_message_handler(std::function<void(std::string)> on_message);
    void send(std::vector<uint8_t> message);
    ConnectionStatus status();

   private:  // Methods
    std::shared_future<void> reconnect();
    void set_handlers(ws_client::connection_ptr con);
#ifdef BASED_TLS
    using context_ptr = std::shared_ptr<boost::asio::ssl::context>;
    static context_ptr on_tls_init();
#endif

   private:  // Members
    ws_client m_endpoint;
    ConnectionStatus m_status;
    websocketpp::connection_hdl m_hdl;
    std::string m_uri;
    std::shared_ptr<std::thread> m_thread;
    std::shared_future<void> m_reconnect_future;
    std::function<void()> m_on_open;
    std::function<void(std::string)> m_on_message;
    // set this when destroying the connection object to prevent a reconnection attempt
    int m_reconnect_attempts;
    bool m_terminating;
};

#endif