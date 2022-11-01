#ifndef BASED_H
#define BASED_H

#include <cstdint>
#include <string>

using based_id = int32_t;

extern "C" based_id Based__new_client();
extern "C" void Based__delete_client(based_id client_id);

extern "C" int test();

extern "C" std::string Based__get_service(based_id client_id,
                                          std::string cluster,
                                          std::string org,
                                          std::string project,
                                          std::string env,
                                          std::string name,
                                          std::string key,
                                          bool optional_key);

extern "C" void Based__connect_to_url(based_id client_id, std::string url);
extern "C" void Based__connect(based_id client_id,
                               std::string cluster,
                               std::string org,
                               std::string project,
                               std::string env,
                               std::string name,
                               std::string key,
                               bool optional_key);

extern "C" void Based__disconnect(based_id client_id);
extern "C" int Based__observe(
    based_id client_id,
    std::string name,
    std::string payload,
    /**
     * Callback that the observable will trigger.
     */
    std::function<void(std::string /*data*/, uint64_t /*checksum*/, std::string /*error*/)> cb);

extern "C" void Based__get(based_id client_id,
                           std::string name,
                           std::string payload,
                           std::function<void(std::string /*data*/, std::string /*error*/)> cb);

extern "C" void Based__unobserve(based_id client_id, int sub_id);

extern "C" void Based__function(
    based_id client_id,
    std::string name,
    std::string payload,
    std::function<void(std::string /*data*/, std::string /*error*/)> cb);

extern "C" void Based__auth(based_id client_id,
                            std::string state,
                            std::function<void(std::string)> cb);

#endif