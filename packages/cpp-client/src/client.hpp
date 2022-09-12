#ifndef BASED_CLIENT_H
#define BASED_CLIENT_H

#include <map>
#include <set>
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
    AUTH_DATA = 4,
    ERROR_DATA = 5
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
    int32_t m_sub_id = 0;
    bool m_draining = false;

    std::map<int, std::function<void(std::string)>> m_function_listeners;
    std::map<int, std::function<void(std::string)>> m_error_listeners;

    /**
     * Requests should be added to this queue when a new observable is created,
     * and when the client reconnects.
     *
     * Never when a new sub is added to the same obs_id.
     */
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
    std::map<int, std::vector<uint8_t>> m_observe_requests;

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
    std::map<int, std::function<void(std::string, int64_t)>> m_sub_on_data;

    /**
     * map<sub_id, on_error callback>
     * List of on_data callback to call when receiving an error for that obs_id.
     */

    std::map<int, std::function<void(std::string)>> m_sub_on_error;

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
    std::map<int, std::function<void(std::string)>> m_get_sub_on_data;

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
     * Observe a function. This returns the sub_id used to
     * unsubscribe with .unobserve(id)
     */
    int observe(std::string name,
                std::string payload,
                /**
                 * Callback that the observable will trigger.
                 */
                std::function<void(std::string /*data*/, int64_t /*checksum*/)> on_data,
                /**
                 * This is optional. Can be set to NULL if no onError callback is required.
                 */
                std::function<void(std::string /*error*/)> on_error,
                ObservableOpts obs_opts) {
        /**
         * Each observable must be stored in memory, in case the connection drops.
         * So there's a queue, which is emptied on drain, but is refilled with the observables
         * stored in memory in the event of a reconnection.
         *
         * These observables all have a list of listeners. Each listener has a on_data callback
         * and and optional on_error callback.
         *
         * When all listeners are removed with .unobserve, the observable should be removed
         * and the unobserve request should be queued, to let the server know.
         */

        int32_t obs_id = make_obs_id(name, payload);
        int32_t sub_id = m_sub_id++;

        std::cout << "obs_id sent = " << obs_id << std::endl;

        if (m_observe_requests.find(obs_id) == m_observe_requests.end()) {
            // first time this query is observed
            // encode request
            // TODO: remove hardcoded checksum after implementing cache
            std::vector<uint8_t> msg = Utility::encode_observe_message(obs_id, name, payload, 0);

            // add encoded request to queue
            m_observe_queue.push_back(msg);

            // add encoded request to map of observables
            m_observe_requests[obs_id] = msg;

            // add subscriber to list of subs for this observable
            m_observe_subs[obs_id] = std::set<int>{sub_id};

            // record what obs this sub is for, to delete it later
            m_sub_to_obs[sub_id] = obs_id;

            // add on_data for this sub
            m_sub_on_data[sub_id] = on_data;

            // add on_error for this sub if on_error is present (overload?)
            if (on_error) m_sub_on_error[sub_id] = on_error;
        } else {
            // this query has already been requested once, only add subscriber,
            // dont send a new request.

            // add subscriber to that observable
            m_observe_subs.at(obs_id).insert(sub_id);

            // record what obs this sub is for, to delete it later
            m_sub_to_obs[sub_id] = obs_id;

            // add on_data for this new sub
            m_sub_on_data[sub_id] = on_data;

            // add on_error for this new sub if it exists
            if (on_error) m_sub_on_error[sub_id] = on_error;
        }

        drain_queues();

        return sub_id;
    }

    void get(std::string name, std::string payload, std::function<void(std::string)> cb) {
        // state objects:
        // std::map<obs_id, std::set<int>> m_get_subs;
        // std::map<int, std::function<void(std::string, int64_t)>> m_get_sub_on_data;

        int32_t obs_id = make_obs_id(name, payload);
        int32_t sub_id = m_sub_id++;

        // if obs_id exists in get_subs, add new sub to list
        std::cout << "obs_id sent = " << obs_id << std::endl;
        if (m_get_subs.find(obs_id) != m_get_subs.end()) {
            std::cout << "obs_id already exists on m_get_subs" << std::endl;
            m_get_subs.at(obs_id).insert(sub_id);
        } else {  // else create it and then add it
            std::cout << "obs_id did not exists on m_get_subs, making new one" << std::endl;
            m_get_subs[obs_id] = std::set<int>{sub_id};
        }
        m_get_sub_on_data[sub_id] = cb;
        // is there an acrive obs? if so, do nothing (get will trigger on next update)
        // if there isnt, queue request
        if (m_observe_requests.find(obs_id) == m_observe_requests.end()) {
            // TODO: remove hardcoded checksum when cache is implemented
            std::vector<uint8_t> msg = Utility::encode_get_message(obs_id, name, payload, 0);
            m_get_queue.push_back(msg);
            drain_queues();
        }
    }

    void unobserve(int sub_id) {
        std::cout << "> Removing sub_id " << sub_id << std::endl;
        if (m_sub_to_obs.find(sub_id) == m_sub_to_obs.end()) {
            std::cerr << "No subscription found with sub_id " << sub_id << std::endl;
            return;
        }
        auto obs_id = m_sub_to_obs.at(sub_id);

        // remove sub from list of subs for that observable
        m_observe_subs.at(obs_id).erase(sub_id);

        // remove on_data callback
        m_sub_on_data.erase(sub_id);

        // remove on_error callback
        m_sub_on_error.erase(sub_id);

        // remove sub to obs mapping for removed sub
        m_sub_to_obs.erase(sub_id);

        // if the list is now empty, add request to unobserve to queue
        if (m_observe_subs.at(obs_id).empty()) {
            std::vector<uint8_t> msg = Utility::encode_unobserve_message(obs_id);
            m_unobserve_queue.push_back(msg);
            // and remove the obs from the map of active ones.
            m_observe_requests.erase(obs_id);
            // and the vector of listeners, since it's now empty we can free the memory
            m_observe_subs.erase(obs_id);
        }
        drain_queues();
    }

    void function(std::string name, std::string payload, std::function<void(std::string)> cb) {
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
    }

    void auth(std::string token) {
        std::cout << "auth not implemented yet" << std::endl;
    }

   private:
    // methods
    int32_t make_obs_id(std::string& name, std::string& payload) {
        if (payload.length() == 0) {
            int32_t payload_hash = (int32_t)std::hash<json>{}("");
            int32_t name_hash = (int32_t)std::hash<std::string>{}(name);

            int32_t obs_id = (payload_hash * 33) ^ name_hash;  // TODO: check with jim

            return obs_id;
        }
        json p = json::parse(payload);
        int32_t payload_hash = (int32_t)std::hash<json>{}(p);
        int32_t name_hash = (int32_t)std::hash<std::string>{}(name);

        int32_t obs_id = (payload_hash * 33) ^ name_hash;  // TODO: check with jim
        return obs_id;
    }

    void drain_queues() {
        if (m_draining || (m_con.status() == ConnectionStatus::CONNECTING)) {
            drain_queues();
            return;
        }
        if (m_con.status() == ConnectionStatus::CLOSED ||
            m_con.status() == ConnectionStatus::FAILED) {
            std::cerr << "Connection is dead, status = " << m_con.status() << std::endl;
            return;
        }

        std::cout << "> Draining queue" << std::endl;

        m_draining = true;

        std::vector<uint8_t> buff;

        if (m_observe_queue.size() > 0) {
            for (auto msg : m_observe_queue) {
                buff.insert(buff.end(), msg.begin(), msg.end());
            }
            m_observe_queue.clear();
        }

        if (m_unobserve_queue.size() > 0) {
            for (auto msg : m_unobserve_queue) {
                buff.insert(buff.end(), msg.begin(), msg.end());
            }
            m_unobserve_queue.clear();
        }

        if (m_function_queue.size() > 0) {
            for (auto msg : m_function_queue) {
                buff.insert(buff.end(), msg.begin(), msg.end());
            }
            m_function_queue.clear();
        }

        if (m_get_queue.size() > 0) {
            for (auto msg : m_get_queue) {
                buff.insert(buff.end(), msg.begin(), msg.end());
            }
            m_get_queue.clear();
        }

        if (buff.size() > 0) m_con.send(buff);

        m_draining = false;
    }

    void on_open() {
        // TODO: Resend all subscriptions
        // for (auto const& [key, val] : m_observe_requests) {}
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
                int id = Utility::read_bytes_from_string(message, 4, 3);

                if (m_function_listeners.find(id) != m_function_listeners.end()) {
                    std::function<void(std::string)> fn = m_function_listeners.at(id);
                    if (len != 3) {
                        int start = 7;
                        int end = len + 4;
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
            }
                return;
            case IncomingType::SUBSCRIPTION_DATA: {
                uint64_t obs_id = Utility::read_bytes_from_string(message, 4, 8);
                int checksum = Utility::read_bytes_from_string(message, 12, 8);

                int start = 20;  // size of header
                int end = len + 4;
                std::string payload = "";
                if (len != 16) {
                    payload = is_deflate ? Utility::inflate_string(message.substr(start, end))
                                         : message.substr(start, end);
                }

                if (m_observe_subs.find(obs_id) != m_observe_subs.end()) {
                    for (auto sub_id : m_observe_subs.at(obs_id)) {
                        auto fn = m_sub_on_data.at(sub_id);
                        fn(payload, checksum);
                    }
                }

                if (m_get_subs.find(obs_id) != m_get_subs.end()) {
                    for (auto sub_id : m_get_subs.at(obs_id)) {
                        std::cout << "firing sub id = " << sub_id << std::endl;
                        auto fn = m_get_sub_on_data.at(sub_id);
                        fn(payload);
                        m_get_sub_on_data.erase(sub_id);
                    }
                    m_get_subs.at(obs_id).clear();
                } else {
                    std::cout << "No such obs_id in the get_subs, obs_id = " << obs_id << std::endl;
                }
            }
                return;
            case IncomingType::SUBSCRIPTION_DIFF_DATA: {
                std::cerr << "Diffing not implemented yet, should never happen." << std::endl;
            } break;
            case IncomingType::GET_DATA:
                std::cout << "received get data?" << std::endl;
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
