#ifndef BASED_OUTGOING_H
#define BASED_OUTGOING_H

#include <cstdint>
#include <iostream>
#include <string>
#include <vector>

#include <json.hpp>

using json = nlohmann::json;

class Encoder {
   public:
    void store_uint8(
        std::vector<char> buff /*probably? need something to append to, by reference i guess*/,
        int32_t n,
        int start,
        int len) {}
    std::string encode_payload(json obj) {
        return obj.dump();
    };
    std::vector<uint8_t> encode_header(int32_t type, int32_t is_deflate, int32_t len) {
        // must do int32_t arithmetics because of the js client
        std::cout << "len " << len << std::endl;
        int32_t meta = (type << 1) + is_deflate;
        int32_t value = (len << 4) + meta;
        std::vector<uint8_t> res;
        for (int i = 0; i < 4; i++) {
            uint8_t byte = (value >> (8 * i)) & 0xff;
            res.push_back(byte);
        }
        return res;
    }
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

    std::vector<uint8_t> encode_function_message(int id, std::string name, std::string payload) {
        int32_t len = 7;
        char const* data = name.data();
        std::cout << "original name = " << name << ", len = " << name.length() << std::endl;
        len += 1 + name.length();
        if (payload.length() > 0) {
            std::cout << "Encoding payload... " << std::endl;
            std::string p = encode_payload(json::parse(payload));
            len += p.length();
        }
        std::vector<uint8_t> header = encode_header(0, 0, len);
        for (int i = 0; i < header.size(); i++) {
            std::cout << "header " << i << " = " << (int)header.at(i) << ",\t 0x" << std::hex
                      << +header.at(i) << std::endl;
        }

        std::cout << "here 1" << std::endl;

        return header;
    }
    std::string encode_auth_message(int id, std::string payload) {}
};

// class Outgoing {
//    public:
//     Outgoing(WsConnection& con) : m_con(con) {}
//     void add_to_fn_queue() {}
//     void add_to_obs_queue() {}
//     void add_to_get_queue() {}
//     void drain_queue() {}

//    private:
//     WsConnection& m_con;
//     Encoder m_encoder;
//     // all the queues
// };

#endif