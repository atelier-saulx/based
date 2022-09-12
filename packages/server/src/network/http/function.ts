import { isObservableFunctionSpec } from '../../functions'
import { BasedServer } from '../../server'
import { HttpClient } from '../../types'
import zlib from 'node:zlib'

const sendResponse = (
  client: HttpClient,
  encoding: string,
  result: any,
  checkHeaders: boolean
) => {
  // or export this fn

  if (!client.res) {
    return
  }

  client.res.writeStatus('200 OK')
  client.res.writeHeader('Access-Control-Allow-Origin', '*')
  client.res.writeHeader('Access-Control-Allow-Headers', 'content-type')
  // lets add the headers before

  //  res.writeHeader('Content-Type', 'application/json')

  // handle response
  if (typeof result === 'string') {
    // res.writeHeader('Content-Type', 'application/json')
    // res.writeHeader('Content-Type', 'text/plain')
    // res.writeHeader('Cache-Control', 'max-age=10')
    // const checksum = version || hash(result)
    /*  
        const checksum = hashObjectIgnoreKeyOrder(r)
        ok(res)
        res.writeHeader('ETag', String(checksum))
        res.writeHeader('Cache-Control', 'max-age=0, must-revalidate')
    */

    client.res?.end(result)
  } else {
    client.res?.end(JSON.stringify(result))
  }

  let compressor
  if (encoding.includes('deflate')) {
    client.res.writeHeader('Content-Encoding', 'deflate')
    compressor = zlib.createDeflate()
  } else if (encoding.includes('gzip')) {
    client.res.writeHeader('Content-Encoding', 'gzip')
    compressor = zlib.createGzip()
  } else if (encoding.includes('br')) {
    client.res.writeHeader('Content-Encoding', 'br')
    compressor = zlib.createBrotliCompress()
  }

  if (compressor) {
    compressor.on('data', (buffer) => {
      if (client.res) {
        client.res.write(
          buffer.buffer.slice(
            buffer.byteOffset,
            buffer.byteOffset + buffer.byteLength
          )
        )
      }
    })
    compressor.on('end', () => {
      client.res?.end()
    })
  } else {
    // res.end()
  }
}

export const functionRest = (
  name: string,
  payload: any,
  encoding: string,
  client: HttpClient,
  server: BasedServer
): void => {
  // handle deflate
  // handle query
  // handle data from get
  // set correct headers
  // error
  // auth

  server.functions
    .get(name)
    .then((spec) => {
      if (!client.res) {
        return
      }
      if (spec && !isObservableFunctionSpec(spec)) {
        server.auth.config
          .authorize(server, client, 'function', name, payload)
          .then((ok) => {
            if (!client.res) {
              return
            }
            if (!ok) {
              client.res?.writeStatus('401 Unauthorized')
              client.res?.end('WRONG AUTH')
            } else {
              spec
                .function(payload, client)
                .then(async (result) => {
                  if (!client.res) {
                    return
                  }
                  if (spec.customHttpResponse) {
                    if (
                      // add send (for encoding and stuff)
                      await spec.customHttpResponse(result, payload, client)
                    ) {
                      // eval headers here
                      // if true all is handled
                      return
                    }
                    sendResponse(client, encoding, result, true)
                  } else {
                    sendResponse(client, encoding, result, false)
                  }
                })
                .catch(() => {
                  if (!client.res) {
                    return
                  }
                  // error handling nice
                  // SEND ERROR sendResponse(client, encoding, result)
                  // and auth
                  client.res?.end('wrong!')
                })
            }
          })
          .catch((err) => {
            if (!client.res) {
              return
            }
            console.error('no auth', err)
            // SEND ERROR sendResponse(client, encoding, result)

            client.res?.end('wrong!')
          })
      } else {
        console.error('No function for you')
        // SEND ERROR sendResponse(client, encoding, result)

        client.res?.end('wrong!')
      }
    })
    .catch((err) => {
      console.error('fn does not exist', err)
      // SEND ERROR sendResponse(client, encoding, result)

      client.res?.end('wrong!')
    })
}
