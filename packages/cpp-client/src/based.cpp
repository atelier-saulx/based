#include "based.hpp"
#include "basedclient.hpp"

#include <map>

std::map<based_id, BasedClient*> clients;
based_id idx = 0;

extern "C" based_id Based__new_client() {
    BasedClient* cl = new BasedClient;
    idx++;

    if (clients.find(idx) != clients.end()) {
        throw std::runtime_error("Ran out of client indices");
    }

    clients[idx] = cl;

    return idx;
}

extern "C" void Based__delete_client(based_id id) {
    if (clients.find(id) == clients.end()) {
        std::cerr << "No such id found" << std::endl;
        return;
    }
    delete clients.at(id);
    clients.erase(id);
}

extern "C" std::string Based__get_service(based_id client_id,
                               std::string cluster,
                               std::string org,
                               std::string project,
                               std::string env,
                               std::string name,
                               std::string key,
                               bool optional_key) {
    if (clients.find(client_id) == clients.end()) {
        std::cerr << "No such id found" << std::endl;
        return "";
    }
    auto cl = clients.at(client_id);
    return cl->get_service(cluster, org, project, env, name, key, optional_key);
}

extern "C" void Based__connect_to_url(based_id client_id, std::string url) {
    if (clients.find(client_id) == clients.end()) {
        std::cerr << "No such id found" << std::endl;
        return;
    }
    auto cl = clients.at(client_id);
    cl->_connect_to_url(url);
}

extern "C" void Based__conect(based_id client_id,
                   std::string cluster,
                   std::string org,
                   std::string project,
                   std::string env,
                   std::string name,
                   std::string key,
                   bool optional_key) {
    if (clients.find(client_id) == clients.end()) {
        std::cerr << "No such id found" << std::endl;
        return;
    }
    auto cl = clients.at(client_id);
    cl->connect(cluster, org, project, env, name, key, optional_key);
}

extern "C" void Based__disconnect(based_id client_id) {
    if (clients.find(client_id) == clients.end()) {
        std::cerr << "No such id found" << std::endl;
        return;
    }
    auto cl = clients.at(client_id);
    cl->disconnect();
}

extern "C" int Based__observe(
    based_id client_id,
    std::string name,
    std::string payload,
    /**
     * Callback that the observable will trigger.
     */
    std::function<void(std::string /*data*/, uint64_t /*checksum*/, std::string /*error*/)> cb) {
    if (clients.find(client_id) == clients.end()) {
        std::cerr << "No such id found" << std::endl;
        return -1;
    }
    auto cl = clients.at(client_id);
    return cl->observe(name, payload, cb);
}

extern "C" void Based__get(based_id client_id,
                std::string name,
                std::string payload,
                std::function<void(std::string /*data*/, std::string /*error*/)> cb) {
    if (clients.find(client_id) == clients.end()) {
        std::cerr << "No such id found" << std::endl;
        return;
    }
    auto cl = clients.at(client_id);
    cl->get(name, payload, cb);
}

extern "C" void Based__unobserve(based_id client_id, int sub_id) {
    if (clients.find(client_id) == clients.end()) {
        std::cerr << "No such id found" << std::endl;
        return;
    }
    auto cl = clients.at(client_id);
    cl->unobserve(sub_id);
}

extern "C" void Based__function(based_id client_id,
                     std::string name,
                     std::string payload,
                     std::function<void(std::string /*data*/, std::string /*error*/)> cb) {
    if (clients.find(client_id) == clients.end()) {
        std::cerr << "No such id found" << std::endl;
        return;
    }
    auto cl = clients.at(client_id);
    cl->function(name, payload, cb);
}

extern "C" void Based__auth(based_id client_id, std::string state, std::function<void(std::string)> cb) {
    if (clients.find(client_id) == clients.end()) {
        std::cerr << "No such id found" << std::endl;
        return;
    }
    auto cl = clients.at(client_id);
    cl->auth(state, cb);
}