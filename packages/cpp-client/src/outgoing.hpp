#ifndef BASED_OUTGOING_H
#define BASED_OUTGOING_H

#include <cstdint>
#include <string>
#include <vector>

#include "connection.hpp"

class Encoder {
   public:
    void store_uint8(
        std::vector<uint8_t> /*probably? need something to append to, by reference i guess*/ buff,
        int32_t n,
        int start,
        int len) {}
    int32_t encode_header(int32_t type, int32_t id_deflate, int32_t len) {}
    std::string encode_header(std::string payload) {}
    std::string encode_get_observe_message(int id,
                                           int type,
                                           std::string name,
                                           int checksum,
                                           std::string payload) {}
    std::string encode_observe_message(int id,
                                       int type,
                                       std::string name,
                                       int checksum,
                                       std::string payload) {}

    std::string encode_function_message(int id, std::string name, std::string payload) {}
    std::string encode_auth_message(int id, std::string payload) {}
};

class Outgoing {
   public:
    Outgoing(WsConnection& con) : m_con(con) {}
    void add_to_fn_queue() {}
    void add_to_obs_queue() {}
    void add_to_get_queue() {}
    void drain_queue() {}

   private:
    WsConnection& m_con;
    Encoder m_encoder;
    // all the queues
};

#endif