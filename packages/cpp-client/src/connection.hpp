#ifndef BASED_WS_CONNECTION_H
#define BASED_WS_CONNECTION_H

#include <iostream>
#include <string>
#include <websocketpp/client.hpp>
#include <websocketpp/config/asio_no_tls_client.hpp>

#include "incoming.hpp"

typedef websocketpp::client<websocketpp::config::asio_client> ws_client;

enum ConnectionStatus { OPEN = 0, CONNECTING, CLOSED, FAILED };

class WsConnection {
    // eventually there should be some logic here to handle inactivity.
   public:
    WsConnection(Incoming& in) : m_in(in) {
        std::cout << "Created a new WsConnection" << std::endl;
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
        std::cout << "Destroyed WsConnection obj" << std::endl;
    };
    int connect(std::string uri) {
        m_uri = uri;
        websocketpp::lib::error_code ec;

        // create connection request to uri
        ws_client::connection_ptr con = m_ws.get_connection(m_uri, ec);

        if (ec) {
            std::cout << "> Connect initialization error: " << ec.message() << std::endl;
            m_status = ConnectionStatus::FAILED;
            return -1;
        }

        m_con = con;

        // bind must be used if the function we're binding to doest have the right number of
        // arguments (hence the placeholders) these handlers must be set before calling connect, and
        // can't be changed after (i think)
        con->set_message_handler([](websocketpp::connection_hdl hdl, ws_client::message_ptr msg) {
            // here we will pass the message to the decoder, which, based on the header, will call
            // the appropriate callback

            // m_data_handler->incoming(msg);

            if (msg->get_opcode() == websocketpp::frame::opcode::text) {
                std::cout << "[MSG::TEXT] " << msg->get_payload() << std::endl;
            } else {
                std::cout << "[MSG::HEX]" << websocketpp::utility::to_hex(msg->get_payload())
                          << std::endl;
            }
        });

        m_ws.connect(con);
        std::cout << "Connected to ws, uri = " << m_uri << std::endl;
        return 0;
    };
    void disconnect() {
        // this is the same as the destructor: change?
        m_ws.stop_perpetual();

        if (m_status == ConnectionStatus::OPEN) {
            // Only close open connections
            std::cout << "> Closing connection" << std::endl;

            websocketpp::lib::error_code ec;
            m_ws.close(m_con->get_handle(), websocketpp::close::status::going_away, "", ec);
            if (ec) {
                std::cout << "> Error closing connection: " << ec.message() << std::endl;
                return;
            }
            m_status = ConnectionStatus::CLOSED;
        }

        m_thread->join();
    };
    void send(std::string const& message) {
        std::cout << "Sending message to ws" << std::endl;

        websocketpp::lib::error_code ec;

        m_ws.send(m_con->get_handle(), message, websocketpp::frame::opcode::text, ec);
        if (ec) {
            std::cout << "> Error sending message: " << ec.message() << std::endl;
            return;
        }
    };

   private:
    ws_client m_ws;
    ConnectionStatus m_status;
    ws_client::connection_ptr m_con;
    std::string m_uri;
    websocketpp::lib::shared_ptr<websocketpp::lib::thread> m_thread;
    Incoming& m_in;
};

#endif
