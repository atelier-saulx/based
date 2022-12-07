#ifndef BASED_CLIENT_H
#define BASED_CLIENT_H

#define BASED_EXPORT __attribute__((__visibility__("default")))

#include <map>
#include <set>
#include <string>
#include <vector>

#include "connection.hpp"

struct Observable;

/////////////////
// Forward declarations
/////////////////

class BasedClient {
   private:
    WsConnection m_con;
    int32_t m_request_id;
    int32_t m_sub_id;

    bool m_draining;

    bool m_auth_in_progress;
    bool m_auth_required;
    std::string m_auth_state;
    std::string m_auth_request_state;
    void (*m_auth_callback)(const char*);

    std::map<int, void (*)(const char*, const char*)> m_function_callbacks;

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
    std::map<int, void (*)(const char*, uint64_t, const char*)> m_sub_callback;

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
    std::map<int, void (*)(const char*, const char*)> m_get_sub_callbacks;

   public:
    BasedClient();

    /**
     * @brief Function to retrieve the url of a specific service.
     *
     * @param cluster Url of the desired cluster
     * @param org Organization name
     * @param project Project name
     * @param env Environment name
     * @param name Name of the service, for example "@based/hub"
     * @param key Optional string, for named hubs or other named service.
     * @param optional_key Boolean, set to true if it should fall back to the default service in
     * case the named one is not found
     * @return std::string of the url
     */
    std::string get_service(std::string cluster,
                            std::string org,
                            std::string project,
                            std::string env,
                            std::string name,
                            std::string key,
                            bool optional_key);

    /**
     * @brief Connect directly to a websocket url.
     */
    void _connect_to_url(std::string url);

    /**
     * @brief Connect to a Based service
     *
     * @param cluster Url of the desired cluster
     * @param org Organization name
     * @param project Project name
     * @param env Environment name
     * @param name Name of the service, for example "@based/hub"
     * @param key Optional string, for named hubs or other named service.
     * @param optional_key Boolean, set to true if it should fall back to the default service in
     * case the named one is not found
     */
    void connect(std::string cluster,
                 std::string org,
                 std::string project,
                 std::string env,
                 std::string name,
                 std::string key,
                 bool optional_key);

    /**
     * @brief Close connection;
     */
    void disconnect();

    /**
     * @brief Observe a function. This returns the sub_id used to unsubscribe with .unobserve(id)
     */
    int observe(std::string name,
                std::string payload,
                /**
                 * Callback that the observable will trigger.
                 */
                void (*cb)(const char*, uint64_t, const char*));

    /**
     * @brief Get the value of an observable only once. The callback will trigger when the function
     * fires a new update.
     */
    void get(std::string name, std::string payload, void (*cb)(const char*, const char*));

    /**
     * @brief Stop the observable associated with the ID, and clean up the related structures.
     * This will also send the unobserve request to the server, if there are no
     * subscribers left for this observable.
     *
     * @param sub_id The ID return by the call to .observe.
     */
    void unobserve(int sub_id);

    /**
     * @brief Run a remote function.
     *
     * @param name Name of the function to call.
     * @param payload Payload of the function, must be a JSON string.
     * @param cb Callback function, must have two string arguments: first is for data, the seconds
     * one is for error.
     */
    void function(std::string name, std::string payload, void (*cb)(const char*, const char*));

    /**
     * @brief Set a auth state.
     *
     * @param state Any object, usually the token
     * @param cb This callback will fire with either be "true" or the auth state itself.
     */
    void auth(std::string state, void (*cb)(const char*));

   private:
    /**
     * @brief Handle incoming messages.
     */
    void on_message(std::string message);

    /**
     * @brief Drain the request queues by sending the request message to the server
     *
     */
    void drain_queues();

    /**
     * @brief When the client goes out of sync with the server, send request to get the full data
     * rather than the diffing patch.
     *
     * @param obs_id
     */
    void request_full_data(uint64_t obs_id);

    /**
     * @brief (Re)send the list of active observables when the connection (re)opens
     */
    void on_open();
};

#endif
