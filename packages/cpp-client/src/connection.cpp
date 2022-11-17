#include "connection.hpp"

WsConnection::WsConnection()
    : m_status(ConnectionStatus::CLOSED),
      m_on_open(NULL),
      m_on_message(NULL),
      m_reconnect_attempts(0),
      m_terminating(false) {
    std::cout << "[libbased::connection] >> Created a new WsConnection" << std::endl;
    // set the endpoint logging behavior to silent by clearing all of the access and error
    // logging channels
    m_endpoint.clear_access_channels(websocketpp::log::alevel::all);
    m_endpoint.clear_error_channels(websocketpp::log::elevel::all);

    m_endpoint.init_asio();
#ifdef BASED_TLS
    m_endpoint.set_tls_init_handler(websocketpp::lib::bind(&WsConnection::on_tls_init));
#endif

    // perpetual mode the endpoint's processing loop will not exit automatically when it has no
    // connections
    m_endpoint.start_perpetual();
    // // run perpetually in a thread
    m_thread = std::make_shared<std::thread>(&ws_client::run, &m_endpoint);
};
WsConnection::~WsConnection() {
    m_terminating = true;
    m_endpoint.stop_perpetual();
    if (m_status == ConnectionStatus::OPEN) {
        // Only close open connections
        std::cout << "[libbased::connection] >> Closing connection" << std::endl;

        websocketpp::lib::error_code ec;
        m_endpoint.close(m_hdl, websocketpp::close::status::going_away, "", ec);
        if (ec) {
            std::cout << "[libbased::connection] >> Error closing connection: " << ec.message()
                      << ec.value() << std::endl;
        }
    }
    m_thread->join();
    std::cout << "[libbased::connection] >> Destroyed WsConnection obj" << std::endl;
};
int WsConnection::connect(std::string uri) {
    m_uri = uri;
    websocketpp::lib::error_code ec;
    ws_client::connection_ptr con = m_endpoint.get_connection(m_uri, ec);

    if (ec) {
        std::cout << "[libbased::connection] >> Connect initialization error: " << ec.message()
                  << std::endl;
        m_status = ConnectionStatus::FAILED;
        return -1;
    }

    m_status = ConnectionStatus::CONNECTING;
    m_hdl = con->get_handle();

    set_handlers(con);

    m_endpoint.connect(con);
    std::cout << "[libbased::connection] >> Connecting to ws, uri = " << m_uri << std::endl;

    return 0;
};

void WsConnection::set_open_handler(std::function<void()> on_open) {
    m_on_open = on_open;
};
void WsConnection::set_message_handler(std::function<void(std::string)> on_message) {
    m_on_message = on_message;
};

void WsConnection::disconnect() {
    m_endpoint.stop_perpetual();

    if (m_status == ConnectionStatus::OPEN) {
        // Only close open connections
        std::cout << "[libbased::connection] >> Closing connection" << std::endl;

        websocketpp::lib::error_code ec;
        m_endpoint.close(m_hdl, websocketpp::close::status::going_away, "", ec);
        if (ec) {
            std::cout << "[libbased::connection] >> Error closing connection: " << ec.message()
                      << std::endl;
            return;
        }
        m_status = ConnectionStatus::CLOSED;
    }

    m_thread->join();
};

void WsConnection::send(std::vector<uint8_t> message) {
    std::cout << "[libbased::connection] >> Sending message to ws" << std::endl;

    websocketpp::lib::error_code ec;

    if (m_status != ConnectionStatus::OPEN) throw(std::runtime_error("Connection is not open."));

    m_endpoint.send(m_hdl, message.data(), message.size(), websocketpp::frame::opcode::binary, ec);
    if (ec) {
        std::cout << "[libbased::connection] >> Error sending message: " << ec.message()
                  << std::endl;
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
std::shared_future<void> WsConnection::reconnect() {
    return std::async(std::launch::async, [&]() {
        if (m_status != ConnectionStatus::OPEN && !m_terminating) {
            // maximum timeout between attempts, in ms
            int timeout = m_reconnect_attempts > 15 ? 1500 : m_reconnect_attempts * 100;
            if (m_reconnect_attempts > 0) {
                std::this_thread::sleep_for(std::chrono::milliseconds(timeout));
            }
            m_reconnect_attempts++;
            connect(m_uri);
        }
    });
}
void WsConnection::set_handlers(ws_client::connection_ptr con) {
    // bind must be used if the function we're binding to doest have the right number of
    // arguments (hence the placeholders) these handlers must be set before calling connect, and
    // can't be changed after (i think)
    con->set_open_handler([this](websocketpp::connection_hdl) {
        std::cout << "[libbased::connection] >> Received OPEN event" << std::endl;
        m_status = ConnectionStatus::OPEN;
        m_reconnect_attempts = 0;
        if (m_on_open) {
            m_on_open();
        }
    });

    con->set_message_handler([this](websocketpp::connection_hdl hdl, ws_client::message_ptr msg) {
        // here we will pass the message to the decoder, which, based on the header, will
        // call the appropriate callback
        std::string payload = msg->get_payload();

        // if (msg->get_opcode() == websocketpp::frame::opcode::text) {
        //     std::cout << " [MSG::TEXT] " << payload << std::endl;
        // } else {
        //     std::cout << " [MSG::HEX]" << websocketpp::utility::to_hex(payload) <<
        //     std::endl;
        // }
        if (m_on_message) {
            m_on_message(payload);
        }
    });

    con->set_close_handler([this](websocketpp::connection_hdl) {
        std::cout << "[libbased::connection] >> Received CLOSE event" << std::endl;
        m_status = ConnectionStatus::CLOSED;
        if (!m_reconnect_future.valid() ||
            m_reconnect_future.wait_for(std::chrono::seconds(0)) == std::future_status::ready) {
            m_reconnect_future = reconnect();
        }
    });

    con->set_fail_handler([this](websocketpp::connection_hdl) {
        std::cout << "[libbased::connection] >> Received FAIL event" << std::endl;
        m_status = ConnectionStatus::FAILED;
        if (!m_reconnect_future.valid() ||
            m_reconnect_future.wait_for(std::chrono::seconds(0)) == std::future_status::ready) {
            m_reconnect_future = reconnect();
        }
    });
}
