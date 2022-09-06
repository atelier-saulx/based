#ifndef BASED_INCOMING_H
#define BASED_INCOMING_H

#include <websocketpp/client.hpp>
#include <websocketpp/config/asio_no_tls_client.hpp>

typedef websocketpp::client<websocketpp::config::asio_client> ws_client;

#include "cb_store.hpp"
#include "connection.hpp"

enum IncomingType {
    FUNCTION_DATA = 0,
    SUBSCRIPTION_DATA = 1,
    SUBSCRIPTION_DIFF_DATA = 2,
    GET_DATA = 3,
    AUTH_DATA = 4
};

class Incoming {
   public:
    Incoming(CallbackStore& cb_store) : m_cb_store(cb_store){};

    void on_message(ws_client::message_ptr msg) {
        std::string message = msg->get_payload();
        if (message.length() <= 4) {
            std::cerr << "Payload is too small, wrong data: " << message << std::endl;
            return;
        }
        int32_t header = read_uint8(message, 0, 4);
        int32_t type = get_payload_type(header);
        int32_t len = get_payload_len(header);
        int32_t is_deflate = get_payload_is_deflate(header);
        switch (type) {
            case IncomingType::FUNCTION_DATA:
                break;
            case IncomingType::SUBSCRIPTION_DATA:
                break;
            case IncomingType::SUBSCRIPTION_DIFF_DATA:
                break;
            case IncomingType::GET_DATA:
                break;
            case IncomingType::AUTH_DATA:
                break;
            default:
                std::cerr << "Unknown payload type \"" << type << "\" received." << std::endl;
                return;
        }
        // std::string header = msg->get_header();
        // std ::string payload = msg->get_payload();
        // std::cout << "[MSG] \n\t[HEADER]" << header << "\n\t[PAYLOAD]" << payload << std::endl;
    };

   private:
    int32_t get_payload_type(int32_t header) {
        int32_t meta = header & 15;
        int32_t type = meta >> 1;
        return type;
    }
    int32_t get_payload_len(int32_t header) {
        int32_t len = header >> 4;
        return len;
    }
    int32_t get_payload_is_deflate(int32_t header) {
        int32_t meta = header & 15;
        int32_t is_deflate = meta & 1;
        return is_deflate;
    }

    int32_t read_uint8(std::string buff, int start, int len) {
        char const* data = buff.data();
        int32_t res = 0;
        size_t s = len - 1 + start;
        for (int i = s; i >= start; i--) {
            res = res * 256 + (uint8_t)data[i];
        }
        return res;
    }

   private:
    CallbackStore& m_cb_store;
};

#endif