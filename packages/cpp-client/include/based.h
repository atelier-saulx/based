#ifndef BASED_H
#define BASED_H

#include <cstdint>
#include <string>

typedef int32_t based_id;
// using based_observe_cb = void (*)(char*, uint64_t, char*);
// using based_cb = void (*)(char*, char*);

extern "C" based_id Based__new_client();
extern "C" void Based__delete_client(based_id client_id);

extern "C" char* Based__get_service(based_id client_id,
                                    char* cluster,
                                    char* org,
                                    char* project,
                                    char* env,
                                    char* name,
                                    char* key,
                                    bool optional_key);

extern "C" void Based__connect_to_url(based_id client_id, char* url);
extern "C" void Based__connect(based_id client_id,
                               char* cluster,
                               char* org,
                               char* project,
                               char* env,
                               char* name,
                               char* key,
                               bool optional_key);

extern "C" void Based__disconnect(based_id client_id);
extern "C" int Based__observe(based_id client_id,
                              char* name,
                              char* payload,
                              /**
                               * Callback that the observable will trigger.
                               */
                              void (*cb)(const char* /* Data */,
                                         uint64_t /* Checksum */,
                                         const char* /* Error*/,
                                         int /*obs_id*/));

extern "C" int Based__get(based_id client_id,
                          char* name,
                          char* payload,
                          void (*cb)(const char* /* Data */,
                                     const char* /* Error */,
                                     int /*sub_id*/));

extern "C" void Based__unobserve(based_id client_id, int sub_id);

extern "C" int Based__function(based_id client_id,
                               char* name,
                               char* payload,
                               void (*cb)(const char* /* Data */,
                                          const char* /* Error */,
                                          int /*request_id*/));

extern "C" void Based__auth(based_id client_id,
                            char* state,
                            void (*cb)(const char* /* Auth response */));

#endif