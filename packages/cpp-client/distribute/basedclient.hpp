#ifndef BASED_CLIENT_H
#define BASED_CLIENT_H

#define BASED_EXPORT __attribute__((__visibility__("default")))

#include <string>

struct Observable;

/////////////////
// Forward declarations
/////////////////

void on_open();
void on_message(std::string message);
void drain_queues();

/**
 * @brief Struct that holds all of the client state.
 */
struct BasedClientStatus;

/**
 * @brief Function to retrieve the url of a specific service.
 *
 * @param cluster Url of the desired cluster
 * @param org Organization name
 * @param project Project name
 * @param env Environment name
 * @param name Name of the service, for example "@based/hub"
 * @param key Optional string, for named hubs or other named service.
 * @param optional_key Boolean, set to true if it should fall back to the default service in case
 * the named one is not found
 * @return std::string of the url
 */
BASED_EXPORT std::string get_service(std::string cluster,
                                     std::string org,
                                     std::string project,
                                     std::string env,
                                     std::string name,
                                     std::string key,
                                     bool optional_key);

/**
 * @brief Connect directly to a websocket url.
 */
BASED_EXPORT void _connect_to_url(std::string url);

/**
 * @brief Connect to a Based service
 *
 * @param cluster Url of the desired cluster
 * @param org Organization name
 * @param project Project name
 * @param env Environment name
 * @param name Name of the service, for example "@based/hub"
 * @param key Optional string, for named hubs or other named service.
 * @param optional_key Boolean, set to true if it should fall back to the default service in case
 * the named one is not found
 */
BASED_EXPORT void connect(std::string cluster,
                          std::string org,
                          std::string project,
                          std::string env,
                          std::string name,
                          std::string key,
                          bool optional_key);

/**
 * @brief Close connection;
 */
BASED_EXPORT void disconnect();

/**
 * @brief Observe a function. This returns the sub_id used to unsubscribe with .unobserve(id)
 */
BASED_EXPORT int observe(
    std::string name,
    std::string payload,
    /**
     * Callback that the observable will trigger.
     */
    std::function<void(std::string /*data*/, uint64_t /*checksum*/, std::string /*error*/)> cb);

/**
 * @brief Get the value of an observable only once. The callback will trigger when the function
 * fires a new update.
 */
BASED_EXPORT void get(std::string name,
                      std::string payload,
                      std::function<void(std::string /*data*/, std::string /*error*/)> cb);

/**
 * @brief Stop the observable associated with the ID, and clean up the related structures.
 * This will also send the unobserve request to the server, if there are no
 * subscribers left for this observable.
 *
 * @param sub_id The ID return by the call to .observe.
 */
BASED_EXPORT void unobserve(int sub_id);

/**
 * @brief Run a remote function.
 *
 * @param name Name of the function to call.
 * @param payload Payload of the function, must be a JSON string.
 * @param cb Callback function, must have two string arguments: first is for data, the seconds
 * one is for error.
 */
BASED_EXPORT void function(std::string name,
                           std::string payload,
                           std::function<void(std::string /*data*/, std::string /*error*/)> cb);

/**
 * @brief Set a auth state.
 *
 * @param state Any object, usually the token
 * @param cb This callback will fire with either be "true" or the auth state itself.
 */
BASED_EXPORT void auth(std::string state, std::function<void(std::string)> cb);

/**
 * @brief Drain the request queues by sending the request message to the server
 *
 */
void drain_queues();

/**
 * @brief When the client goes out of sync with the server, send request to get the full data rather
 * than the diffing patch.
 *
 * @param obs_id
 */
void request_full_data(uint64_t obs_id);

/**
 * @brief (Re)send the list of active observables when the connection (re)opens
 */
void on_open();

/**
 * @brief Handle incoming messages.
 */
void on_message(std::string message);

#endif
