#ifndef BASED_CLIENT_H
#define BASED_CLIENT_H

#include <map>
#include <string>

#include "cb_store.hpp"
#include "connection.hpp"
#include "incoming.hpp"
#include "outgoing.hpp"

struct ObservableOpts {
    ObservableOpts(bool ls, int mct) : local_storage(ls), max_cache_time(mct){};

    bool local_storage;
    int max_cache_time;
};

class BasedClient {
   public:
    BasedClient() : m_in(m_cb_store), m_con(m_in), m_out(m_con) {}

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

    void function(std::string name, std::string_view payload, void (*cb)(std::string_view name)) {
        // create a unique ID that identifies this request
        int new_id = m_request_id++;
        // store the listener in the listeners map
        m_function_handlers[new_id] = cb;
        // add the request to the outgoing queue
        // m_function_req_queue.add(name, payload);
    }

    void get() {
        std::cout << "get not implemented yet" << std::endl;
    }

    void auth(std::string token) {
        std::cout << "auth not implemented yet" << std::endl;
    }

   private:
    CallbackStore m_cb_store;
    Incoming m_in;
    WsConnection m_con;
    Outgoing m_out;
    int m_request_id = 0;
    std::map<int, void (*)(std::string_view /*data*/, int /*checksum*/)> m_observe_handlers;
    std::map<int, void (*)(std::string_view)> m_function_handlers;
};

#endif
