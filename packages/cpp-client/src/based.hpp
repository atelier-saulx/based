#ifndef BASED_H
#define BASED_H

#include <cstdint>
#include "basedclient.hpp"

using based_id = int32_t;

based_id Based__new_client();
void Based__delete_client(based_id client);

std::string Based__get_service(based_id client,
                               std::string cluster,
                               std::string org,
                               std::string project,
                               std::string env,
                               std::string name,
                               std::string key,
                               bool optional_key);

void Based__connect_to_url(based_id client, std::string url);
void Based__conect(based_id client,
                   std::string cluster,
                   std::string org,
                   std::string project,
                   std::string env,
                   std::string name,
                   std::string key,
                   bool optional_key);

void Based__disconnect(based_id client);
int Based__observe(
    based_id client,
    std::string name,
    std::string payload,
    /**
     * Callback that the observable will trigger.
     */
    std::function<void(std::string /*data*/, uint64_t /*checksum*/, std::string /*error*/)> cb);

void Based__get(based_id client,
                std::string name,
                std::string payload,
                std::function<void(std::string /*data*/, std::string /*error*/)> cb);

void Based__unobserve(based_id client, int sub_id);

void Based__function(based_id client,
                     std::string name,
                     std::string payload,
                     std::function<void(std::string /*data*/, std::string /*error*/)> cb);

void Based__auth(based_id client, std::string state, std::function<void(std::string)> cb);

#endif