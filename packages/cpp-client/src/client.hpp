#ifndef BASED_CLIENT_H
#define BASED_CLIENT_H

#include <map>
#include <string>

#include "connection.hpp"

struct ObservableOpts {
    ObservableOpts(bool ls, int mct) : local_storage(ls), max_cache_time(mct){};

    bool local_storage;
    int max_cache_time;
};

class BasedClient {
   public:
    BasedClient(std::string_view uri) : m_connection(uri) {}

    void connect() {
        m_connection.connect();
    }

    /**
     * Observe a function. This returns the observe ID used to
     * unsubscribe with .unobserve(id)
     */
    int observe(std::string name,
                void (*onData)(std::string_view /*data*/, int /*checksum*/),
                std::string_view payload,
                void (*onError)(std::string_view /*error*/),
                ObservableOpts obs_opts) {
        int new_id = m_next_id++;
        m_on_data_handlers[new_id] = onData;

        return new_id;
    }

    void unobserve(int id){};

    void function(void (*cb)(std::string_view name, std::string_view payload)) {}

    void get() {}

    void auth(std::string token) {}

   private:
    WsConnection m_connection;
    int m_next_id = 0;
    std::map<int, void (*)(std::string_view /*data*/, int /*checksum*/)> m_on_data_handlers;
};

#endif
