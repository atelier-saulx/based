#ifndef BASED_OUTGOING_H
#define BASED_OUTGOING_H

#include <zlib.h>

#include <cstdint>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

#include <json.hpp>

using json = nlohmann::json;

namespace Utility {
std::string inflate_string(const std::string& str) {
    // Original version of this function found on https://panthema.net/2007/0328-ZLibString.html,
    // adapted here for our usage.

    // Copyright 2007 Timo Bingmann <tb@panthema.net>
    // Distributed under the Boost Software License, Version 1.0.
    // (See http://www.boost.org/LICENSE_1_0.txt)

    z_stream zs;  // z_stream is zlib's control structure
    memset(&zs, 0, sizeof(zs));

    if (inflateInit2(&zs, -MAX_WBITS) != Z_OK)
        throw(std::runtime_error("inflateInit failed while decompressing."));

    zs.next_in = (Bytef*)str.data();
    zs.avail_in = str.size();

    int ret;
    char outbuffer[32768];
    std::string outstring;

    // get the decompressed bytes blockwise using repeated calls to inflate
    do {
        zs.next_out = reinterpret_cast<Bytef*>(outbuffer);
        zs.avail_out = sizeof(outbuffer);

        ret = inflate(&zs, 0);

        if (outstring.size() < zs.total_out) {
            outstring.append(outbuffer, zs.total_out - outstring.size());
        }

    } while (ret == Z_OK);

    inflateEnd(&zs);

    if (ret != Z_STREAM_END) {  // an error occurred that was not EOF
        std::ostringstream oss;
        oss << "Exception during zlib decompression: (" << ret << ") " << zs.msg;
        throw(std::runtime_error(oss.str()));
    }

    return outstring;
}

std::string deflate_string(const std::string& str) {
    // Original version of this function found on https://panthema.net/2007/0328-ZLibString.html,
    // adapted here for our usage.

    // Copyright 2007 Timo Bingmann <tb@panthema.net>
    // Distributed under the Boost Software License, Version 1.0.
    // (See http://www.boost.org/LICENSE_1_0.txt)

    z_stream zs;  // z_stream is zlib's control structure
    memset(&zs, 0, sizeof(zs));

    // See https://www.zlib.net/manual.html#Advanced for details.
    // The windowBits argument Must match inflate_string and the js client

    if (deflateInit2(&zs, Z_DEFAULT_COMPRESSION, Z_DEFLATED, -MAX_WBITS, 8, Z_DEFAULT_STRATEGY) !=
        Z_OK)
        throw(std::runtime_error("deflateInit failed while compressing."));

    zs.next_in = (Bytef*)str.data();
    zs.avail_in = str.size();  // set the z_stream's input

    int ret;
    char outbuffer[32768];
    std::string outstring;

    // retrieve the compressed bytes blockwise
    do {
        zs.next_out = reinterpret_cast<Bytef*>(outbuffer);
        zs.avail_out = sizeof(outbuffer);

        ret = deflate(&zs, Z_FINISH);

        if (outstring.size() < zs.total_out) {
            // append the block to the output string
            outstring.append(outbuffer, zs.total_out - outstring.size());
        }
    } while (ret == Z_OK);

    deflateEnd(&zs);

    if (ret != Z_STREAM_END) {  // an error occurred that was not EOF
        std::ostringstream oss;
        oss << "Exception during zlib compression: (" << ret << ") " << zs.msg;
        throw(std::runtime_error(oss.str()));
    }

    return outstring;
}

void append_bytes(std::vector<uint8_t>& buff, int64_t src, size_t size) {
    for (int i = 0; i < size; i++) {
        uint8_t byte = (src >> (8 * i)) & 0xff;
        buff.push_back(byte);
    }
}

void append_string(std::vector<uint8_t>& buff, std::string payload) {
    char const* data = payload.data();
    for (int i = 0; i < payload.length(); i++) {
        buff.push_back(data[i]);
    }
}
void append_header(std::vector<uint8_t>& buff, int32_t type, int32_t is_deflate, int32_t len) {
    // must do int32_t arithmetics because of the js client
    int32_t meta = (type << 1) + is_deflate;
    int32_t value = (len << 4) + meta;
    for (int i = 0; i < 4; i++) {
        uint8_t byte = (value >> (8 * i)) & 0xff;
        buff.push_back(byte);
    }
}

std::vector<uint8_t> encode_function_message(int32_t id, std::string name, std::string& payload) {
    std::vector<uint8_t> buff;
    int32_t len = 7;
    len += 1 + name.length();

    int32_t is_deflate = 0;

    std::string p;
    if (payload.length() > 0) {
        std::cout << "> Encoding payload... " << std::endl;

        if (payload.length() > 150) {
            is_deflate = 1;
            std::cout << "> Deflating payload..." << std::endl;
            p = deflate_string(payload);

            // char const* buff = p.data();

            // for (int i = 0; i < p.length(); i++) {
            //     std::cout << "buff " << i << " = " << (int32_t)buff[i] << ",\t 0x" << std::hex
            //               << +buff[i] << std::dec << std::endl;
            // }

        } else {
            p = payload;
        }

        len += p.length();
    }
    append_header(buff, 0, is_deflate, len);
    append_bytes(buff, id, 3);
    buff.push_back(name.length());
    append_string(buff, name);
    if (p.length()) {
        append_string(buff, p);
    }

    // std::cout << "> FINAL BUFFER" << std::endl;
    // for (int i = 0; i < buff.size(); i++) {
    //     std::cout << "buff " << i << " = " << (int)buff.at(i) << ",\t 0x" << std::hex <<
    //     +buff.at(i)
    //               << std::dec << std::endl;
    // }

    return buff;
}

std::vector<uint8_t> encode_observe_message(int64_t id,
                                            std::string name,
                                            std::string& payload,
                                            int64_t checksum) {
    // Type 1 = subscribe
    // | 4 header | 8 id | 8 checksum | 1 name length | * name | [* payload]

    std::vector<uint8_t> buff;

    /**
     * Length in bytes. 4 B header + 8 B id + 8 B checksum,
     * add the rest later based on payload and name.
     */
    int32_t len = 20;
    len += 1 + name.length();

    int32_t is_deflate = 0;

    std::string p;
    if (payload.length() > 0) {
        std::cout << "> Encoding payload... " << std::endl;

        if (payload.length() > 150) {
            is_deflate = 1;
            std::cout << "> Deflating payload..." << std::endl;
            p = deflate_string(payload);
        } else {
            p = payload;
        }

        len += p.length();
    }
    append_header(buff, 1, is_deflate, len);
    append_bytes(buff, id, 8);
    append_bytes(buff, checksum, 8);
    buff.push_back(name.length());
    append_string(buff, name);
    if (p.length()) {
        append_string(buff, p);
    }

    return buff;
}

std::vector<uint8_t> encode_unobserve_message(int64_t obs_id) {
    // Type 2 = unsubscribe
    // | 4 header | 8 id |

    std::vector<uint8_t> buff;

    /**
     * Length in bytes. 4 B header + 8 B id
     */
    int32_t len = 12;

    append_header(buff, 2, 0, len);
    append_bytes(buff, obs_id, 8);
    return buff;
}
// std::string encode_auth_message(int id, std::string payload) {}

int32_t get_payload_type(int32_t header) {
    int32_t meta = header & 15;
    int32_t type = meta >> 1;
    return type;
}
int32_t get_payload_len(int32_t header) {
    int32_t len = header >> 4;
    return len;
}
int32_t get_payload_is_deflate(int32_t header) {
    int32_t meta = header & 15;
    int32_t is_deflate = meta & 1;
    return is_deflate;
}
int32_t read_header(std::string buff) {
    // header starts at index[0] and is 4 bytes long
    char const* data = buff.data();
    int32_t res = 0;
    size_t s = 3;
    for (int i = s; i >= 0; i--) {
        res = res * 256 + (uint8_t)data[i];
    }
    return res;
}

int64_t read_bytes_from_string(std::string& buff, int start, int len) {
    char const* data = buff.data();
    int32_t res = 0;
    size_t s = len - 1 + start;  // len - 1 + start;
    for (int i = s; i >= start; i--) {
        res = res * 256 + (uint8_t)data[i];
    }
    return res;
}

};  // namespace Utility

#endif