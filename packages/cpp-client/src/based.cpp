#include "based.hpp"
#include <map>

std::map<based_id, BasedClient> clients;
based_id idx = 0;

based_id Based__new_client() {
    BasedClient cl;
    idx++;

    if (clients.find(idx) != clients.end()) {
        throw std::runtime_error("Ran out of client indices");
    }

    clients.insert_or_assign(std::make_pair(idx, cl));

    return idx;
}

void Based__delete_client(based_id id) {
    if (clients.find(id) == clients.end()) {
        std::cerr << "No such id found" << std::endl;
        return;
    }
    clients.erase(id);
}

std::string Based__get_service(based_id client,
                               std::string cluster,
                               std::string org,
                               std::string project,
                               std::string env,
                               std::string name,
                               std::string key,
                               bool optional_key) {
    auto cl = clients.find(client);
    if (cl == clients.end()) {
        std::cerr << "No such id found" << std::endl;
        return "";
    } else {
        return cl->get_service();
    }
}