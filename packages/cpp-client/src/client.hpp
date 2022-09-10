#ifndef BASED_CLIENT_H
#define BASED_CLIENT_H

#include <map>
#include <string>
#include <vector>

#include "connection.hpp"
#include "utility.hpp"

using namespace nlohmann::literals;

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
    bool m_draining = false;

    // std::map<int, void (*)(std::string_view /*data*/, int /*checksum*/)> m_observe_handlers;
    std::map<int, std::function<void(std::string_view)>> m_function_listeners;
    std::map<int, std::vector<std::function<void(std::string_view)>>> m_observe_listeners;
    std::map<int, std::function<void(std::string_view)>> m_error_listeners;
    std::vector<std::vector<uint8_t>> m_function_queue;
    std::vector<std::vector<uint8_t>> m_observe_queue;
    std::vector<std::vector<uint8_t>> m_get_observe_queue;

   public:
    BasedClient() {
        m_con.set_message_handler([&](std::string msg) { on_message(msg); });
        m_con.set_open_handler([&]() { on_open(); });
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
        json p = json::parse(payload);
        int32_t payload_hash = (int32_t)std::hash<json>{}(p);
        int32_t name_hash = (int32_t)std::hash<std::string>{}(name);
        int32_t obs_id = (payload_hash * 33) ^ name_hash;  // TODO: check with jim

        if (m_observe_listeners.find(obs_id) != m_observe_listeners.end()) {}

        return 1;
    }

    void unobserve(int id) {
        std::cout << "unobserve not implemented yet" << std::endl;
    }

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
    void drain_queues() {
        if (m_draining || (m_con.status() == ConnectionStatus::CONNECTING)) {
            drain_queues();
            return;
        }
        if (m_con.status() == ConnectionStatus::CLOSED ||
            m_con.status() != ConnectionStatus::FAILED) {
            std::cerr << "Connection is dead, status = " << m_con.status() << std::endl;
            return;
        }

        std::cout << "> Draining queue" << std::endl;

        m_draining = true;

        std::vector<uint8_t> buff;

        if (m_get_observe_queue.size() > 0) {
            for (auto msg : m_get_observe_queue) {
                buff.insert(buff.end(), msg.begin(), msg.end());
            }
            m_get_observe_queue.clear();
        }
        if (m_observe_queue.size() > 0) {
            for (auto msg : m_observe_queue) {
                buff.insert(buff.end(), msg.begin(), msg.end());
            }
            m_observe_queue.clear();
        }

        if (m_function_queue.size() > 0) {
            for (auto msg : m_function_queue) {
                buff.insert(buff.end(), msg.begin(), msg.end());
            }
            m_function_queue.clear();
        }

        m_con.send(buff);

        m_draining = false;
    }

    void add_to_fn_queue(std::string name,
                         std::string payload,
                         std::function<void(std::string_view)> cb) {
        m_request_id++;
        if (m_request_id > 16777215) {
            m_request_id = 0;
        }
        int id = m_request_id;
        m_function_listeners[id] = cb;
        // encode the message
        std::vector<uint8_t> msg = Utility::encode_function_message(id, name, payload);
        m_function_queue.push_back(msg);
        drain_queues();
    };

    void add_to_obs_queue(std::string name,
                          std::string payload,
                          std::function<void(std::string_view)> cb) {
        m_request_id++;
        if (m_request_id > 16777215) {
            m_request_id = 0;
        }
        int id = m_request_id;
        m_function_listeners[id] = cb;
        // encode the message
        std::vector<uint8_t> msg = Utility::encode_function_message(id, name, payload);
        m_function_queue.push_back(msg);
        drain_queues();
    };

    void on_open() {
        // Resend all subscriptions
        // for (auto const& [key, val] : m_observe_list){}
    }

    void on_message(std::string message) {
        if (message.length() <= 7) {
            std::cerr << ">> Payload is too small, wrong data: " << message << std::endl;
            return;
        }
        int32_t header = Utility::read_header(message);
        int32_t type = Utility::get_payload_type(header);
        int32_t len = Utility::get_payload_len(header);
        int32_t is_deflate = Utility::get_payload_is_deflate(header);

        // std::cout << "type = " << type << std::endl;
        // std::cout << "len = " << len << std::endl;
        // std::cout << "is_deflate = " << is_deflate << std::endl;

        switch (type) {
            case IncomingType::FUNCTION_DATA: {
                int32_t id = Utility::read_id(message);

                if (m_function_listeners.find(id) != m_function_listeners.end()) {
                    std::function<void(std::string_view)> fn = m_function_listeners.at(id);
                    if (len != 3) {
                        int32_t start = 7;
                        int32_t end = len + 4;
                        std::string payload =
                            is_deflate ? Utility::inflate_string(message.substr(start, end))
                                       : message.substr(start, end);
                        fn(payload);
                    } else {
                        std::cout << "no payload" << std::endl;
                        fn("");
                    }
                    // Listener has fired, remove it from the map.
                    m_function_listeners.erase(id);
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
