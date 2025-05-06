import http from 'http'
import httpProxy from 'http-proxy'

//
// Create a proxy server with custom application logic
//
var proxy = httpProxy.createProxyServer({})

//
// Create your custom server and just call `proxy.web()` to proxy
// a web request to the target passed in the options
// also you can use `proxy.ws()` to proxy a websockets request
//
var server = http.createServer(function (req, res) {
  // You can define here your custom logic to handle the request
  // and then proxy the request.
  proxy.web(req, res, { target: 'http://127.0.0.1:9910' })
})

server.listen(5050)
