#ifndef BASED_WS_CONNECTION_H
#define BASED_WS_CONNECTION_H

#include <iostream>
#include <string>
#include <thread>
#include <websocketpp/client.hpp>

#ifdef BASED_TLS
#include <websocketpp/config/asio_client.hpp>                                 // SSL
typedef websocketpp::client<websocketpp::config::asio_tls_client> ws_client;  // SSL
#else
#include <websocketpp/config/asio_no_tls_client.hpp>  // No SSL
typedef websocketpp::client<websocketpp::config::asio_client> ws_client;  // No SSL
#endif

enum ConnectionStatus { OPEN = 0, CONNECTING, CLOSED, FAILED, TERMINATED_BY_USER };

class WsConnection {
    // eventually there should be some logic here to handle inactivity.
   public:
    WsConnection();
    ~WsConnection();
    void connect(std::string cluster,
                 std::string org,
                 std::string project,
                 std::string env,
                 //  std::string name,
                 std::string key,
                 bool optional_key);
    void connect_to_uri(std::string uri);
    void disconnect();
    void set_open_handler(std::function<void()> on_open);
    void set_message_handler(std::function<void(std::string)> on_message);
    void send(std::vector<uint8_t> message);
    ConnectionStatus status();
    std::string get_service(std::string cluster,
                            std::string org,
                            std::string project,
                            std::string env,
                            std::string name,
                            std::string key,
                            bool optional_key);

    void set_handlers(ws_client::connection_ptr con);
#ifdef BASED_TLS
#ifdef ASIO_STANDALONE
    using context_ptr = std::shared_ptr<asio::ssl::context>;
    static context_ptr on_tls_init();
#else
    // Use Boost
    using context_ptr = std::shared_ptr<boost::asio::ssl::context>;
    static context_ptr on_tls_init();
#endif
#endif
   private:  // Methods
    std::shared_future<void> reconnect();

   private:  // Members
    ws_client* m_endpoint;
    websocketpp::connection_hdl m_hdl;
    ConnectionStatus m_status;
    std::string m_uri;
    std::shared_ptr<std::thread> m_thread;
    std::shared_future<void> m_reconnect_future;
    std::function<void()> m_on_open;
    std::function<void(std::string)> m_on_message;
    int m_reconnect_attempts;
    int m_registry_index;

    std::string m_cluster;
    std::string m_org;
    std::string m_project;
    std::string m_env;
    std::string m_key;
    bool m_optional_key;
};

#endif