#ifndef BASED_CLIENT_H
#define BASED_CLIENT_H

#include <map>
#include <string>
#include <vector>

// #include "cb_store.hpp"
#include "connection.hpp"
// #include "incoming.hpp"
#include "outgoing.hpp"

struct ObservableOpts {
    ObservableOpts(bool ls, int mct) : local_storage(ls), max_cache_time(mct){};

    bool local_storage;
    int max_cache_time;
};

class BasedClient {
    // members
   private:
    Encoder m_encoder;
    WsConnection m_con;
    int32_t m_request_id = 0;
    // std::map<int, void (*)(std::string_view /*data*/, int /*checksum*/)> m_observe_handlers;
    std::map<int, void (*)(std::string_view)> m_function_listeners;
    std::vector<std::string> m_function_queue;

   public:
    BasedClient() {}

    void connect(std::string uri) {
        m_con.connect(uri);
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

    void function(std::string name, std::string payload, void (*cb)(std::string_view name)) {
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
    void add_to_fn_queue(std::string name, std::string payload, void (*cb)(std::string_view)) {
        m_request_id++;
        if (m_request_id > 16777215) {
            m_request_id = 0;
        }
        int id = m_request_id;
        m_function_listeners[id] = cb;
        // encode the message
        m_encoder.encode_function_message(id, name, payload);

        // m_function_queue.push_back(msg);
    };
};

#endif
