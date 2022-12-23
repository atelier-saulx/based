#include "connection.hpp"
#include <curl/curl.h>
#include <json.hpp>
#include "utility.hpp"

#define DEFAULT_CLUSTER_URL "https://d15p61sp2f2oaj.cloudfront.net"

using namespace nlohmann::literals;
using json = nlohmann::json;

///////////////////////////////////////////////////
//////////////// Helper functions /////////////////
///////////////////////////////////////////////////

static size_t write_function(void* contents, size_t size, size_t nmemb, void* userp) {
    ((std::string*)userp)->append((char*)contents, size * nmemb);
    return size * nmemb;
}

//////////////////////////////////////////////////////////////////////////
///////////////////////// Class methods /////////////////////////////////
//////////////////////////////////////////////////////////////////////////

WsConnection::WsConnection()
    : m_status(ConnectionStatus::CLOSED),
      m_on_open(NULL),
      m_on_message(NULL),
      m_reconnect_attempts(0),
      m_registry_index(0),
      m_cluster(""),
      m_org(""),
      m_project(""),
      m_env(""),
      m_key(""),
      m_optional_key(false) {
    // set the endpoint logging behavior to silent by clearing all of the access and error
    // logging channels
    m_endpoint.clear_access_channels(websocketpp::log::alevel::all);
    m_endpoint.clear_error_channels(websocketpp::log::elevel::all);

    // try {
    m_endpoint.init_asio();
    // } catch (const websocketpp::exception& e) {
    //     std::cout << "CAUGHT ERROR!!!" << e.m_msg << std::endl;
    // }
#ifdef BASED_TLS
    m_endpoint.set_tls_init_handler(websocketpp::lib::bind(&WsConnection::on_tls_init));
#endif

    // perpetual mode = the endpoint's processing loop will not exit automatically when it has
    // no connections
    m_endpoint.start_perpetual();
    // // run perpetually in a thread

    // std::make_shared<std::thread>(&ws_client::run, m_endpoint);
    m_thread = std::make_shared<std::thread>(&ws_client::run, &m_endpoint);
};

WsConnection::~WsConnection() {
    disconnect();
    m_endpoint.stop_perpetual();
    m_thread->join();

    BASED_LOG("Destroyed WsConnection obj");
};

std::string WsConnection::get_service(std::string cluster,
                                      std::string org,
                                      std::string project,
                                      std::string env,
                                      std::string name,
                                      std::string key,
                                      bool optional_key) {
    const char* url;
    if (cluster.length() < 1) url = DEFAULT_CLUSTER_URL;
    else url = cluster.c_str();

    CURL* curl;
    CURLcode res;
    std::string buf;

    curl = curl_easy_init();
    if (!curl) {
        throw std::runtime_error("curl object failed to initialize");
    }
    // Set up curl
    curl_easy_setopt(curl, CURLOPT_URL, url);
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, write_function);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &buf);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT, 3L);        // timeout after 3 seconds
    curl_easy_setopt(curl, CURLOPT_SSL_VERIFYPEER, 0);  // TODO: do this better

    res = curl_easy_perform(curl);  // get list of registry urls
    if (res != 0) {
        if (res == CURLE_OPERATION_TIMEDOUT) {
            throw std::runtime_error("Operation timed out");
        }
        std::cerr << "error with easy_perform, code: " << res << std::endl;
    }

    json registries = json::array();

    if (buf.length() > 0) registries = json::parse(buf);
    else {}

    m_registry_index++;
    if (m_registry_index >= registries.size()) m_registry_index = 0;

    std::string registry_url = registries.at(m_registry_index);
    std::string req_url = registry_url + "/" + org + "." + project + "." + env + "." + name;
    if (key.length() > 0) req_url += "." + key;
    if (key.length() > 0 && optional_key) req_url += "$";

    buf = "";
    curl_easy_setopt(curl, CURLOPT_URL, req_url.c_str());

    res = curl_easy_perform(curl);  // get service url from selected registry
    if (res == CURLE_OPERATION_TIMEDOUT) {
        throw std::runtime_error("Operation timed out");
    }

    curl_easy_cleanup(curl);

    return buf;
}

void WsConnection::connect(std::string cluster,
                           std::string org,
                           std::string project,
                           std::string env,
                           std::string key,
                           bool optional_key) {
    m_cluster = cluster;
    m_org = org;
    m_project = project;
    m_env = env;
    m_key = key;
    m_optional_key = optional_key;

    // TODO: check if async is better for this
    std::thread con_thr([&, org, project, env, cluster, key, optional_key]() {
        std::string service_url =
            get_service(cluster, org, project, env, "@based/edge", key, optional_key);
        connect_to_uri(service_url);
    });
    con_thr.detach();
}

void WsConnection::connect_to_uri(std::string uri) {
    // std::async(std::launch::async, [&]() {
    // maximum timeout between attempts, in ms
    int timeout = m_reconnect_attempts > 15 ? 1500 : m_reconnect_attempts * 100;
    if (m_reconnect_attempts > 0) {
        std::this_thread::sleep_for(std::chrono::milliseconds(timeout));
    }

    if (m_status == ConnectionStatus::OPEN) {
        BASED_LOG("Attempting to connect while connection is already open, do nothing...");
        return;
    }
    BASED_LOG("Attempting to connect to \"%s\"", uri.c_str());

    m_uri = uri;
    websocketpp::lib::error_code ec;
    ws_client::connection_ptr con = m_endpoint.get_connection(m_uri, ec);

    if (ec) {
        BASED_LOG("Error trying to initialize connection, message = \"%s\"", ec.message().c_str());
        m_status = ConnectionStatus::FAILED;
        return;
    }

    m_status = ConnectionStatus::CONNECTING;
    m_hdl = con->get_handle();

    set_handlers(con);

    m_endpoint.connect(con);
    BASED_LOG("Connection created");

    return;
    // });
};

void WsConnection::set_open_handler(std::function<void()> on_open) {
    m_on_open = on_open;
};
void WsConnection::set_message_handler(std::function<void(std::string)> on_message) {
    m_on_message = on_message;
};

void WsConnection::disconnect() {
    if (m_status != ConnectionStatus::OPEN) {
        return;
    }

    BASED_LOG("Connection terminated by user, closing...");

    m_status = ConnectionStatus::TERMINATED_BY_USER;

    websocketpp::lib::error_code ec;
    m_endpoint.close(m_hdl, websocketpp::close::status::going_away, "", ec);
    if (ec) {
        BASED_LOG("Error trying to close connection, message = \"%s\"", ec.message().c_str());

        return;
    }
};

void WsConnection::send(std::vector<uint8_t> message) {
    BASED_LOG("Sending message to websocket");
    websocketpp::lib::error_code ec;

    if (m_status != ConnectionStatus::OPEN) throw(std::runtime_error("Connection is not open."));

    m_endpoint.send(m_hdl, message.data(), message.size(), websocketpp::frame::opcode::binary, ec);
    if (ec) {
        BASED_LOG("Error trying to send message, message = \"%s\"", ec.message().c_str());
        return;
    }
};

ConnectionStatus WsConnection::status() {
    return m_status;
};

#ifdef BASED_TLS
#ifdef ASIO_STANDALONE
using context_ptr = std::shared_ptr<asio::ssl::context>;

context_ptr WsConnection::on_tls_init() {
    context_ptr ctx = std::make_shared<asio::ssl::context>(asio::ssl::context::sslv23);

    try {
        ctx->set_options(asio::ssl::context::default_workarounds | asio::ssl::context::no_sslv2 |
                         asio::ssl::context::no_sslv3 | asio::ssl::context::single_dh_use);

    } catch (std::exception& e) {
        std::cout << "Error in context pointer: " << e.what() << std::endl;
    }
    return ctx;
}
#else
using context_ptr = std::shared_ptr<boost::asio::ssl::context>;

context_ptr WsConnection::on_tls_init() {
    context_ptr ctx =
        std::make_shared<boost::asio::ssl::context>(boost::asio::ssl::context::sslv23);

    try {
        ctx->set_options(boost::asio::ssl::context::default_workarounds |
                         boost::asio::ssl::context::no_sslv2 | boost::asio::ssl::context::no_sslv3 |
                         boost::asio::ssl::context::single_dh_use);

    } catch (std::exception& e) {
        std::cout << "Error in context pointer: " << e.what() << std::endl;
    }
    return ctx;
}
#endif
#endif
// std::shared_future<void> WsConnection::reconnect() {
//     return std::async(std::launch::async, [&]() {
//         if (m_status != ConnectionStatus::OPEN &&
//             m_status != ConnectionStatus::TERMINATED_BY_USER) {
//             // maximum timeout between attempts, in ms
//             int timeout = m_reconnect_attempts > 15 ? 1500 : m_reconnect_attempts * 100;
//             if (m_reconnect_attempts > 0) {
//                 std::this_thread::sleep_for(std::chrono::milliseconds(timeout));
//             }
//             m_reconnect_attempts++;
//             std::cout << "hello" << std::endl;
//             if (m_cluster.length() > 0) {
//                 std::cout << "hello2" << std::endl;
//                 connect(m_cluster, m_org, m_project, m_env, m_key, m_optional_key);
//             } else if (m_uri.length() > 0) {
//                 std::cout << "hello3" << std::endl;
//                 connect_to_uri(m_uri);
//             }
//         }
//     });
// }
void WsConnection::set_handlers(ws_client::connection_ptr con) {
    // bind must be used if the function we're binding to doest have the right number of
    // arguments (hence the placeholders) these handlers must be set before calling connect, and
    // can't be changed after (i think)
    con->set_open_handler([this](websocketpp::connection_hdl) {
        BASED_LOG("Received OPEN event");
        m_status = ConnectionStatus::OPEN;
        m_reconnect_attempts = 0;
        if (m_on_open) {
            m_on_open();
        }
    });

    con->set_message_handler([this](websocketpp::connection_hdl hdl, ws_client::message_ptr msg) {
        // here we will pass the message to the decoder, which, based on the header, will
        // call the appropriate callback
        BASED_LOG("Received MESSAGE event");

        std::string payload = msg->get_payload();
        if (m_on_message) {
            m_on_message(payload);
        }
    });

    con->set_close_handler([this](websocketpp::connection_hdl) {
        BASED_LOG("Received CLOSE event");
        if (m_status != ConnectionStatus::TERMINATED_BY_USER) {
            m_status = ConnectionStatus::CLOSED;
            m_reconnect_attempts++;

            if (!m_cluster.empty()) {
                connect(m_cluster, m_org, m_project, m_env, m_key, m_optional_key);
            } else {
                connect_to_uri(m_uri);
            }
        }
    });

    con->set_fail_handler([this](websocketpp::connection_hdl) {
        BASED_LOG("Received FAIL event");
        m_status = ConnectionStatus::FAILED;
        m_reconnect_attempts++;

        if (!m_cluster.empty()) {
            connect(m_cluster, m_org, m_project, m_env, m_key, m_optional_key);
        } else {
            connect_to_uri(m_uri);
        }
    });
}
