#ifndef BASED_CB_STORE_H
#define BASED_CB_STORE_H

#include <map>
#include <string>

#include "client.hpp"

class CallbackStore {
   private:
    std::map<int, void (*)(std::string_view /*data*/, int /*checksum*/)> m_observe_handlers;
    std::map<int, void (*)(std::string_view)> m_function_handlers;
};

#endif