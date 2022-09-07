#ifndef BASED_CLIENT_H
#define BASED_CLIENT_H

#include <map>
#include <string>
#include <vector>

#include "connection.hpp"
#include "utility.hpp"

enum IncomingType {
    FUNCTION_DATA = 0,
    SUBSCRIPTION_DATA = 1,
    SUBSCRIPTION_DIFF_DATA = 2,
    GET_DATA = 3,
    AUTH_DATA = 4
};

struct ObservableOpts {
    ObservableOpts(bool ls, int mct) : local_storage(ls), max_cache_time(mct){};

    bool local_storage;
    int max_cache_time;
};

class BasedClient {
    // members
   private:
    WsConnection m_con;
    int32_t m_request_id = 0;
    // std::map<int, void (*)(std::string_view /*data*/, int /*checksum*/)> m_observe_handlers;
    std::map<int, std::function<void(std::string_view)>> m_function_listeners;
    std::vector<std::string> m_function_queue;

   public:
    BasedClient() {
        // m_con.set_message_handler([](std::string msg) {
        //     int32_t header = Utility::read_header(msg);
        //     std::cout << "type = " << Utility::get_payload_type(header) << std::endl;
        //     std::cout << "len = " << Utility::get_payload_len(header) << std::endl;
        //     std::cout << "is_deflate = " << Utility::get_payload_is_deflate(header) << std::endl;
        // });

        m_con.set_message_handler([&](std::string msg) { on_message(msg); });
    }

    void connect(std::string uri) {
        m_con.connect(uri);
    }

    void disconnect() {
        m_con.disconnect();
    }

    /**
     * Observe a function. This returns the observe ID used to
     * unsubscribe with .unobserve(id)
     */
    int observe(std::string name,
                std::string_view payload,
                void (*onData)(std::string_view /*data*/, int /*checksum*/),
                void (*onError)(std::string_view /*error*/),
                ObservableOpts obs_opts) {
        // m_request_id needs to be replaced by the observe hash later
        std::cout << "observe not implemented yet" << std::endl;

        return 0;
        // int new_id = m_request_id++;
        // m_observe_handlers[new_id] = onData;

        // return new_id;
    }

    void unobserve(int id) {
        std::cout << "unobserve not implemented yet" << std::endl;
    };

    void function(std::string name, std::string payload, std::function<void(std::string_view)> cb) {
        add_to_fn_queue(name, payload, cb);
    }

    void get() {
        std::cout << "get not implemented yet" << std::endl;
    }

    void auth(std::string token) {
        std::cout << "auth not implemented yet" << std::endl;
    }

   private:
    // methods
    void add_to_fn_queue(std::string name,
                         std::string payload,
                         std::function<void(std::string_view)> cb) {
        // TODO: these must be sent in order
        m_request_id++;
        if (m_request_id > 16777215) {
            m_request_id = 0;
        }
        int id = m_request_id;
        m_function_listeners[id] = cb;
        // encode the message
        std::vector<uint8_t> msg = Utility::encode_function_message(id, name, payload);
        m_con.sendBinary(msg);

        // m_function_queue.push_back(msg);
    };

    void on_message(std::string message) {
        if (message.length() <= 4) {
            std::cerr << ">> Payload is too small, wrong data: " << message << std::endl;
            return;
        }
        int32_t header = Utility::read_header(message);
        int32_t type = Utility::get_payload_type(header);
        int32_t len = Utility::get_payload_len(header);
        int32_t is_deflate = Utility::get_payload_is_deflate(header);

        switch (type) {
            case IncomingType::FUNCTION_DATA: {
                int32_t id = Utility::read_id(message);
                if (m_function_listeners.find(id) != m_function_listeners.end()) {
                    std::function<void(std::string_view)> fn = m_function_listeners.at(id);
                    fn("");
                }
                break;
            }
            case IncomingType::SUBSCRIPTION_DATA:
                break;
            case IncomingType::SUBSCRIPTION_DIFF_DATA:
                break;
            case IncomingType::GET_DATA:
                break;
            case IncomingType::AUTH_DATA:
                break;
            default:
                std::cerr << ">> Unknown payload type \"" << type << "\" received." << std::endl;
                return;
        }
        // std::string header = msg->get_header();
        // std ::string payload = msg->get_payload();
        // std::cout << "[MSG] \n\t[HEADER]" << header << "\n\t[PAYLOAD]" << payload << std::endl;
    };
};

#endif
