#ifndef BASED_WS_CONNECTION_H
#define BASED_WS_CONNECTION_H

#include <iostream>
#include <string>
#include <thread>
#include <websocketpp/client.hpp>
#include <websocketpp/config/asio_no_tls_client.hpp>

typedef websocketpp::client<websocketpp::config::asio_client> ws_client;

enum ConnectionStatus { OPEN = 0, CONNECTING, CLOSED, FAILED };

class WsConnection {
    // eventually there should be some logic here to handle inactivity.
   public:
    WsConnection() : m_status(ConnectionStatus::CLOSED), m_on_open(NULL), m_on_message(NULL) {
        std::cout << "> Created a new WsConnection" << std::endl;
        // set the endpoint logging behavior to silent by clearing all of the access and error
        // logging channels
        m_endpoint.clear_access_channels(websocketpp::log::alevel::all);
        m_endpoint.clear_error_channels(websocketpp::log::elevel::all);
    };
    ~WsConnection() {
        m_endpoint.stop_perpetual();

        if (m_status == ConnectionStatus::OPEN) {
            // Only close open connections
            std::cout << "> Closing connection" << std::endl;

            websocketpp::lib::error_code ec;
            m_endpoint.close(m_hdl, websocketpp::close::status::going_away, "", ec);
            if (ec) {
                std::cout << "> Error closing connection: " << ec.message() << ec.value()
                          << std::endl;
            }
        }

        m_thread->join();
        std::cout << "> Destroyed WsConnection obj" << std::endl;
    };
    int connect(std::string uri) {
        m_endpoint.init_asio();
        // perpetual mode the endpoint's processing loop will not exit automatically when it has no
        // connections
        m_endpoint.start_perpetual();
        m_uri = uri;
        websocketpp::lib::error_code ec;

        // create connection request to uri
        ws_client::connection_ptr con = m_endpoint.get_connection(m_uri, ec);

        if (ec) {
            std::cout << "> Connect initialization error: " << ec.message() << std::endl;
            m_status = ConnectionStatus::FAILED;
            return -1;
        }

        m_status = ConnectionStatus::CONNECTING;

        m_hdl = con->get_handle();

        // bind must be used if the function we're binding to doest have the right number of
        // arguments (hence the placeholders) these handlers must be set before calling connect, and
        // can't be changed after (i think)
        con->set_open_handler([this](websocketpp::connection_hdl) {
            std::cout << ">> Received OPEN event" << std::endl;
            m_status = ConnectionStatus::OPEN;
            if (m_on_open) {
                m_on_open();
            }
        });

        con->set_message_handler([this](websocketpp::connection_hdl hdl,
                                        ws_client::message_ptr msg) {
            // here we will pass the message to the decoder, which, based on the header, will
            // call the appropriate callback

            // m_data_handler->incoming(msg);

            std::string payload = msg->get_payload();

            if (msg->get_opcode() == websocketpp::frame::opcode::text) {
                std::cout << " [MSG::TEXT] " << payload << std::endl;
            } else {
                std::cout << " [MSG::HEX]" << websocketpp::utility::to_hex(payload) << std::endl;
            }
            if (m_on_message) {
                m_on_message(payload);
            }
        });

        con->set_close_handler([this](websocketpp::connection_hdl) {
            std::cout << ">> Received CLOSE event" << std::endl;
            m_status = ConnectionStatus::CLOSED;
        });

        con->set_fail_handler([this](websocketpp::connection_hdl) {
            std::cout << ">> Received FAIL event" << std::endl;
            m_status = ConnectionStatus::FAILED;
        });

        m_endpoint.connect(con);
        std::cout << "> Connecting to ws, uri = " << m_uri << std::endl;

        // // run perpetually in a thread
        m_thread =
            websocketpp::lib::make_shared<websocketpp::lib::thread>(&ws_client::run, &m_endpoint);

        // m_endpoint.run();

        return 0;
    };

    void set_open_handler(std::function<void()> on_open) {
        m_on_open = on_open;
    };
    void set_message_handler(std::function<void(std::string)> on_message) {
        m_on_message = on_message;
    };

    void disconnect() {
        // this is the same as the destructor: change?
        m_endpoint.stop_perpetual();

        if (m_status == ConnectionStatus::OPEN) {
            // Only close open connections
            std::cout << "> Closing connection" << std::endl;

            websocketpp::lib::error_code ec;
            m_endpoint.close(m_hdl, websocketpp::close::status::going_away, "", ec);
            if (ec) {
                std::cout << "> Error closing connection: " << ec.message() << std::endl;
                return;
            }
            m_status = ConnectionStatus::CLOSED;
        }

        m_thread->join();
    };
    void send(std::vector<uint8_t> message) {
        std::cout << "> Sending message to ws" << std::endl;

        websocketpp::lib::error_code ec;

        if (m_status != ConnectionStatus::OPEN)
            throw(std::runtime_error("Connection is not open."));

        m_endpoint.send(m_hdl, message.data(), message.size(), websocketpp::frame::opcode::binary,
                        ec);
        if (ec) {
            std::cout << "> Error sending message: " << ec.message() << std::endl;
            return;
        }
    };

    ConnectionStatus status() {
        return m_status;
    };

   private:
    ws_client m_endpoint;
    ConnectionStatus m_status;
    websocketpp::connection_hdl m_hdl;
    std::string m_uri;
    websocketpp::lib::shared_ptr<websocketpp::lib::thread> m_thread;
    std::function<void()> m_on_open;
    std::function<void(std::string)> m_on_message;
};

#endif
