#include <curl/curl.h>
#include <json.hpp>
#include <map>
#include <set>
#include <stdexcept>
#include <utility>
#include <vector>

#include "apply-patch.hpp"
#include "connection.hpp"
#include "utility.hpp"

#include "basedclient.hpp"

#define DEFAULT_CLUSTER_URL "https://d15p61sp2f2oaj.cloudfront.net"

using namespace nlohmann::literals;

enum IncomingType {
    FUNCTION_DATA = 0,
    SUBSCRIPTION_DATA = 1,
    SUBSCRIPTION_DIFF_DATA = 2,
    GET_DATA = 3,
    AUTH_DATA = 4,
    ERROR_DATA = 5
};

struct Observable {
    Observable(std::string name, std::string payload) : name(name), payload(payload){};

    std::string name;
    std::string payload;
};
struct BasedClientStatus {
    BasedClientStatus()
        : m_request_id(0),
          m_sub_id(0),
          m_draining(false),
          m_auth_in_progress(false),
          m_registry_index(0) {
        m_con.set_message_handler([&](std::string msg) { on_message(msg); });
        m_con.set_open_handler([&]() { on_open(); });
    };

    WsConnection m_con;
    int32_t m_request_id;
    int32_t m_sub_id;

    bool m_draining;

    bool m_auth_in_progress;
    std::string m_auth_state;
    std::string m_auth_request_state;
    std::function<void(std::string)> m_auth_callback;

    std::map<int, std::function<void(std::string, std::string)>> m_function_callbacks;
    int m_registry_index;

    /////////////////////
    // cache
    /////////////////////

    /**
     * map<obs_id, <value, checksum>>
     */
    std::map<int, std::pair<std::string, uint64_t>> m_cache;

    /////////////////////
    // queues
    /////////////////////

    std::vector<std::vector<uint8_t>> m_observe_queue;
    std::vector<std::vector<uint8_t>> m_function_queue;
    std::vector<std::vector<uint8_t>> m_unobserve_queue;
    std::vector<std::vector<uint8_t>> m_get_queue;

    /////////////////////
    // observables
    /////////////////////

    /**
     * map<obs_hash, encoded_request>
     * The list of all the active observables. These should only be deleted when
     * there are no active subs for it. It's used in the event of a reconnection.
     */
    std::map<int, Observable*> m_observe_requests;

    /**
     * map<obs_hash, list of sub_ids>
     * The list of subsribers to the observable. These are tied to a on_data function
     * and an optional on_error function, which should be fired appropriately.
     */
    std::map<int, std::set<int>> m_observe_subs;

    /**
     * <sub_id, obs_hash>
     *  Mapping of which observable a sub_id refers to. Necessary for .unobserve.
     */
    std::map<int, int> m_sub_to_obs;

    /**
     * map<sub_id, on_data callback>
     * List of on_data callback to call when receiving the data.
     */
    std::map<int, std::function<void(std::string, int64_t, std::string)>> m_sub_callback;

    ////////////////
    // gets
    ////////////////

    /**
     * map<obs_hash, list of sub_ids>
     * The list of getters to the observable. These should be fired once, when receiving
     * the sub data, and immediatly cleaned up.
     */
    std::map<int, std::set<int>> m_get_subs;

    /**
     * map<sub_id, on_data callback>
     * List of on_data callback to call when receiving the data. Should be deleted after firing.
     */
    std::map<int, std::function<void(std::string /*data*/, std::string /*error*/)>>
        m_get_sub_callbacks;
};

BasedClientStatus status;

/////////////////
// Helper functions
/////////////////

inline uint32_t make_obs_id(std::string& name, std::string& payload) {
    if (payload.length() == 0) {
        uint32_t payload_hash = (uint32_t)std::hash<json>{}("");
        uint32_t name_hash = (uint32_t)std::hash<std::string>{}(name);

        uint32_t obs_id = (payload_hash * 33) ^ name_hash;

        return obs_id;
    }
    json p = json::parse(payload);
    uint32_t payload_hash = (uint32_t)std::hash<json>{}(p);
    uint32_t name_hash = (uint32_t)std::hash<std::string>{}(name);

    uint32_t obs_id = (payload_hash * 33) ^ name_hash;
    return obs_id;
}

static size_t write_function(void* contents, size_t size, size_t nmemb, void* userp) {
    ((std::string*)userp)->append((char*)contents, size * nmemb);
    return size * nmemb;
}

//////////////////////////////////////////////////////////////////////////
///////////////////////// Client methods /////////////////////////////////
//////////////////////////////////////////////////////////////////////////

std::string get_service(std::string cluster,
                        std::string org,
                        std::string project,
                        std::string env,
                        std::string name,
                        std::string key,
                        bool optional_key) {
    const char* url;
    if (cluster.length() < 1) url = DEFAULT_CLUSTER_URL;
    else url = cluster.c_str();

    CURL* curl;
    CURLcode res;
    std::string buf;

    curl = curl_easy_init();
    if (!curl) {
        throw std::runtime_error("curl object failed to initialize");
    }
    // Set up curl
    curl_easy_setopt(curl, CURLOPT_URL, url);
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, write_function);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &buf);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT, 3L);  // timeout after 3 seconds

    res = curl_easy_perform(curl);  // get list of registry urls

    json registries = json::array();
    registries = json::parse(buf);

    status.m_registry_index++;
    if (status.m_registry_index > registries.size()) status.m_registry_index = 0;

    std::string registry_url = registries.at(status.m_registry_index);
    std::string req_url = registry_url + "/" + org + "." + project + "." + env + "." + name;
    if (key.length() > 0) req_url += "." + key;
    if (optional_key) req_url += "$";

    std::cout << req_url << std::endl;

    buf = "";
    curl_easy_setopt(curl, CURLOPT_URL, req_url.c_str());

    res = curl_easy_perform(curl);  // get service url
    if (res == CURLE_OPERATION_TIMEDOUT) {
        throw std::runtime_error("Operation timed out");
    }
    curl_easy_cleanup(curl);

    return buf;
}

void _connect_to_url(std::string url) {
    status.m_con.connect(url);
}

void connect(std::string cluster,
             std::string org,
             std::string project,
             std::string env,
             std::string name,
             std::string key,
             bool optional_key) {
    std::thread con_thr([&, org, project, env, name, cluster, key, optional_key]() {
        std::string service_url = get_service(cluster, org, project, env, name, key, optional_key);
        status.m_con.connect(service_url);
    });
    con_thr.detach();
}

void disconnect() {
    status.m_con.disconnect();
}

int observe(
    std::string name,
    std::string payload,
    /**
     * Callback that the observable will trigger.
     */
    std::function<void(std::string /*data*/, uint64_t /*checksum*/, std::string /*error*/)> cb) {
    /**
     * Each observable must be stored in memory, in case the connection drops.
     * So there's a queue, which is emptied on drain, but is refilled with the observables
     * stored in memory in the event of a reconnection.
     *
     * These observables all have a list of listeners. Each listener has a cb callback
     * and and optional on_error callback.
     *
     * When all listeners are removed with .unobserve, the observable should be removed
     * and the unobserve request should be queued, to let the server know.
     */

    uint32_t obs_id = make_obs_id(name, payload);
    int32_t sub_id = status.m_sub_id++;

    std::cout << "obs_id sent = " << obs_id << std::endl;

    if (status.m_observe_requests.find(obs_id) == status.m_observe_requests.end()) {
        // first time this query is observed
        // encode request
        uint64_t checksum = 0;

        if (status.m_cache.find(obs_id) != status.m_cache.end()) {
            // if cache for this obs exists
            checksum = status.m_cache.at(obs_id).second;
        }

        std::vector<uint8_t> msg = Utility::encode_observe_message(obs_id, name, payload, checksum);

        // add encoded request to queue
        status.m_observe_queue.push_back(msg);

        // add encoded request to map of observables
        status.m_observe_requests[obs_id] = new Observable(name, payload);

        // add subscriber to list of subs for this observable
        status.m_observe_subs[obs_id] = std::set<int>{sub_id};

        // record what obs this sub is for, to delete it later
        status.m_sub_to_obs[sub_id] = obs_id;

        // add cb for this sub
        status.m_sub_callback[sub_id] = cb;

        // add on_error for this sub if on_error is present (overload?)
    } else {
        // this query has already been requested once, only add subscriber,
        // dont send a new request.

        // add subscriber to that observable
        status.m_observe_subs.at(obs_id).insert(sub_id);

        // record what obs this sub is for, to delete it later
        status.m_sub_to_obs[sub_id] = obs_id;

        // add cb for this new sub
        status.m_sub_callback[sub_id] = cb;
        // add on_error for this new sub if it exists
    }

    drain_queues();

    return sub_id;
}

void get(std::string name,
         std::string payload,
         std::function<void(std::string /*data*/, std::string /*error*/)> cb) {
    uint32_t obs_id = make_obs_id(name, payload);
    int32_t sub_id = status.m_sub_id++;

    // if obs_id exists in get_subs, add new sub to list
    if (status.m_get_subs.find(obs_id) != status.m_get_subs.end()) {
        status.m_get_subs.at(obs_id).insert(sub_id);
    } else {  // else create it and then add it
        status.m_get_subs[obs_id] = std::set<int>{sub_id};
    }
    status.m_get_sub_callbacks[sub_id] = cb;
    // is there an active obs? if so, do nothing (get will trigger on next update)
    // if there isnt, queue request
    if (status.m_observe_requests.find(obs_id) == status.m_observe_requests.end()) {
        uint64_t checksum = 0;

        if (status.m_cache.find(obs_id) != status.m_cache.end()) {
            // if cache for this obs exists
            checksum = status.m_cache.at(obs_id).second;
        }
        std::vector<uint8_t> msg = Utility::encode_get_message(obs_id, name, payload, checksum);
        status.m_get_queue.push_back(msg);
        drain_queues();
    }
}

void unobserve(int sub_id) {
    if (status.m_sub_to_obs.find(sub_id) == status.m_sub_to_obs.end()) {
        std::cerr << "No subscription found with sub_id " << sub_id << std::endl;
        return;
    }
    auto obs_id = status.m_sub_to_obs.at(sub_id);

    // remove sub from list of subs for that observable
    status.m_observe_subs.at(obs_id).erase(sub_id);

    // remove on_data callback
    status.m_sub_callback.erase(sub_id);

    // remove sub to obs mapping for removed sub
    status.m_sub_to_obs.erase(sub_id);

    // if the list is now empty, add request to unobserve to queue
    if (status.m_observe_subs.at(obs_id).empty()) {
        std::vector<uint8_t> msg = Utility::encode_unobserve_message(obs_id);
        status.m_unobserve_queue.push_back(msg);
        // and remove the obs from the map of active ones.
        delete status.m_observe_requests.at(obs_id);
        status.m_observe_requests.erase(obs_id);
        // and the vector of listeners, since it's now empty we can free the memory
        status.m_observe_subs.erase(obs_id);
    }
    drain_queues();
}

void function(std::string name,
              std::string payload,
              std::function<void(std::string /*data*/, std::string /*error*/)> cb) {
    status.m_request_id++;
    if (status.m_request_id > 16777215) {
        status.m_request_id = 0;
    }
    int id = status.m_request_id;
    status.m_function_callbacks[id] = cb;
    // encode the message
    std::vector<uint8_t> msg = Utility::encode_function_message(id, name, payload);
    status.m_function_queue.push_back(msg);
    drain_queues();
}

void auth(std::string state, std::function<void(std::string)> cb) {
    if (status.m_auth_in_progress) return;

    status.m_auth_request_state = state;
    status.m_auth_in_progress = true;
    status.m_auth_callback = cb;

    std::vector<uint8_t> msg = Utility::encode_auth_message(state);
    status.m_con.send(msg);
}

/////////////////////////////////////////////////////////////
/////////////////// End of client methods ///////////////////
/////////////////////////////////////////////////////////////

void drain_queues() {
    if (status.m_draining || status.m_con.status() == ConnectionStatus::CLOSED ||
        status.m_con.status() == ConnectionStatus::FAILED ||
        status.m_con.status() == ConnectionStatus::CONNECTING) {
        std::cerr << "Connection is unavailable, status = " << status.m_con.status() << std::endl;
        return;
    }

    status.m_draining = true;

    std::vector<uint8_t> buff;

    if (status.m_observe_queue.size() > 0) {
        for (auto msg : status.m_observe_queue) {
            buff.insert(buff.end(), msg.begin(), msg.end());
        }
        status.m_observe_queue.clear();
    }

    if (status.m_unobserve_queue.size() > 0) {
        for (auto msg : status.m_unobserve_queue) {
            buff.insert(buff.end(), msg.begin(), msg.end());
        }
        status.m_unobserve_queue.clear();
    }

    if (status.m_function_queue.size() > 0) {
        for (auto msg : status.m_function_queue) {
            buff.insert(buff.end(), msg.begin(), msg.end());
        }
        status.m_function_queue.clear();
    }

    if (status.m_get_queue.size() > 0) {
        for (auto msg : status.m_get_queue) {
            buff.insert(buff.end(), msg.begin(), msg.end());
        }
        status.m_get_queue.clear();
    }

    if (buff.size() > 0) status.m_con.send(buff);

    status.m_draining = false;
}

void request_full_data(uint64_t obs_id) {
    if (status.m_observe_requests.find(obs_id) == status.m_observe_requests.end()) {
        return;
    }
    auto obs = status.m_observe_requests.at(obs_id);
    auto msg = Utility::encode_observe_message(obs_id, obs->name, obs->payload, 0);
    status.m_observe_queue.push_back(msg);
    drain_queues();
}

void on_open() {
    // TODO: must reencode the obs request with the latest checksum.
    //       either change the checksum in the encoded request (harder probs) or
    //       just encode it on drain queue rather than on .observe,
    //       changing the data structure a bit
    for (auto el : status.m_observe_requests) {
        Observable* obs = el.second;
        auto msg = Utility::encode_observe_message(el.first, obs->name, obs->payload, 0);
        status.m_observe_queue.push_back(msg);
    }
    drain_queues();
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

    switch (type) {
        case IncomingType::FUNCTION_DATA: {
            int id = Utility::read_bytes_from_string(message, 4, 3);

            if (status.m_function_callbacks.find(id) != status.m_function_callbacks.end()) {
                auto fn = status.m_function_callbacks.at(id);
                if (len != 3) {
                    int start = 7;
                    int end = len + 4;
                    std::string payload = is_deflate
                                              ? Utility::inflate_string(message.substr(start, end))
                                              : message.substr(start, end);
                    fn(payload, "");
                } else {
                    fn("", "");
                }
                // Listener has fired, remove it from the map.
                status.m_function_callbacks.erase(id);
            }
        }
            return;
        case IncomingType::SUBSCRIPTION_DATA: {
            uint32_t obs_id = Utility::read_bytes_from_string(message, 4, 8);
            uint64_t checksum = Utility::read_bytes_from_string(message, 12, 8);

            int start = 20;  // size of header
            int end = len + 4;
            std::string payload = "";
            if (len != 16) {
                payload = is_deflate ? Utility::inflate_string(message.substr(start, end))
                                     : message.substr(start, end);
            }

            status.m_cache[obs_id].first = payload;
            status.m_cache[obs_id].second = checksum;

            if (status.m_observe_subs.find(obs_id) != status.m_observe_subs.end()) {
                for (auto sub_id : status.m_observe_subs.at(obs_id)) {
                    auto fn = status.m_sub_callback.at(sub_id);
                    fn(payload, checksum, "");
                }
            }

            if (status.m_get_subs.find(obs_id) != status.m_get_subs.end()) {
                for (auto sub_id : status.m_get_subs.at(obs_id)) {
                    auto fn = status.m_get_sub_callbacks.at(sub_id);
                    fn(payload, "");
                    status.m_get_sub_callbacks.erase(sub_id);
                }
                status.m_get_subs.at(obs_id).clear();
            }
        }
            return;
        case IncomingType::SUBSCRIPTION_DIFF_DATA: {
            uint32_t obs_id = Utility::read_bytes_from_string(message, 4, 8);
            uint64_t checksum = Utility::read_bytes_from_string(message, 12, 8);
            uint64_t prev_checksum = Utility::read_bytes_from_string(message, 20, 8);

            uint64_t cached_checksum = 0;

            if (status.m_cache.find(obs_id) != status.m_cache.end()) {
                cached_checksum = status.m_cache.at(obs_id).second;
            }

            if (cached_checksum == 0 || (cached_checksum != prev_checksum)) {
                request_full_data(obs_id);
                return;
            }

            int start = 28;  // size of header
            int end = len + 4;
            std::string patch = "";
            if (len != 24) {
                patch = is_deflate ? Utility::inflate_string(message.substr(start, end))
                                   : message.substr(start, end);
            }

            std::string patched_payload = "";

            if (patch.length() > 0) {
                json value = json::parse(status.m_cache.at(obs_id).first);
                json patch_json = json::parse(patch);
                json res = Diff::apply_patch(value, patch_json);
                patched_payload = res.dump();

                status.m_cache[obs_id].first = patched_payload;
                status.m_cache[obs_id].second = checksum;
            }

            if (status.m_observe_subs.find(obs_id) != status.m_observe_subs.end()) {
                for (auto sub_id : status.m_observe_subs.at(obs_id)) {
                    auto fn = status.m_sub_callback.at(sub_id);
                    fn(patched_payload, checksum, "");
                }
            }

            if (status.m_get_subs.find(obs_id) != status.m_get_subs.end()) {
                for (auto sub_id : status.m_get_subs.at(obs_id)) {
                    auto fn = status.m_get_sub_callbacks.at(sub_id);
                    fn(patched_payload, "");
                    status.m_get_sub_callbacks.erase(sub_id);
                }
                status.m_get_subs.at(obs_id).clear();
            }

        } break;
        case IncomingType::GET_DATA: {
            uint64_t obs_id = Utility::read_bytes_from_string(message, 4, 8);
            if (status.m_get_subs.find(obs_id) != status.m_get_subs.end() &&
                status.m_cache.find(obs_id) != status.m_cache.end()) {
                for (auto sub_id : status.m_get_subs.at(obs_id)) {
                    auto fn = status.m_get_sub_callbacks.at(sub_id);
                    fn(status.m_cache.at(obs_id).first, "");
                    status.m_get_sub_callbacks.erase(sub_id);
                }
                status.m_get_subs.at(obs_id).clear();
            }
        } break;
        case IncomingType::AUTH_DATA: {
            int32_t start = 4;
            int32_t end = len + 4;
            std::string payload = "";
            if (len != 3) {
                payload = is_deflate ? Utility::inflate_string(message.substr(start, end))
                                     : message.substr(start, end);
            }
            if (payload == "true") {
                status.m_auth_state = status.m_auth_request_state;
                status.m_auth_request_state = "";
            } else {
                status.m_auth_state = payload;
            }
            status.m_auth_callback(payload);

            status.m_auth_in_progress = false;
        }
            return;
        case IncomingType::ERROR_DATA: {
            // TODO: test this when errors get implemented in the server

            // std::cout << "Error received. Error handling not implemented yet" << std::endl;
            int32_t start = 4;
            int32_t end = len + 4;
            std::string payload = "{}";
            if (len != 3) {
                payload = is_deflate ? Utility::inflate_string(message.substr(start, end))
                                     : message.substr(start, end);
            }

            json error(payload);
            // fire once
            if (error.find("requestId") != error.end()) {
                auto id = error.at("requestId");
                if (status.m_function_callbacks.find(id) != status.m_function_callbacks.end()) {
                    auto fn = status.m_function_callbacks.at(id);
                    fn("", payload);
                    status.m_function_callbacks.erase(id);
                }
                if (status.m_get_subs.find(id) != status.m_get_subs.end()) {
                    for (auto get_id : status.m_get_subs.at(id)) {
                        auto fn = status.m_get_sub_callbacks.at(get_id);
                        fn("", payload);
                        status.m_get_sub_callbacks.erase(get_id);
                    }
                    status.m_get_subs.erase(id);
                }
            }
            if (error.find("observableId") != error.end()) {
                // destroy observable
                auto obs_id = error.at("observableId");
                if (status.m_observe_subs.find(obs_id) != status.m_observe_subs.end()) {
                    for (auto sub_id : status.m_observe_subs.at(obs_id)) {
                        if (status.m_sub_callback.find(sub_id) != status.m_sub_callback.end()) {
                            auto fn = status.m_sub_callback.at(sub_id);
                            fn("", 0, payload);
                        }
                    }
                }
            }
        }
            return;
        default:
            std::cerr << ">> Unknown payload type \"" << type << "\" received." << std::endl;
            return;
    }
};
