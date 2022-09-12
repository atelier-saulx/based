import { isObservableFunctionSpec } from '../../functions'
import { BasedServer } from '../../server'
import { HttpClient } from '../../types'
import { hash, hashObjectIgnoreKeyOrder } from '@saulx/hash'
import zlib from 'node:zlib'

const sendResponse = (
  client: HttpClient,
  encoding: string,
  result: any,
  checkHeaders: boolean,
  checksum?: number
) => {
  if (!client.res) {
    return
  }

  client.res.writeStatus('200 OK')
  client.res.writeHeader('Access-Control-Allow-Origin', '*')
  client.res.writeHeader('Access-Control-Allow-Headers', 'content-type')
  client.res?.writeHeader('Cache-Control', 'max-age=10')

  let parsed: string

  // handle response
  if (typeof result === 'string') {
    client.res?.writeHeader('Content-Type', 'text/plain')
    parsed = result
    if (parsed.length > 30) {
      client.res?.writeHeader('ETag', String(checksum || hash(parsed)))
    }
  } else {
    client.res?.writeHeader('Content-Type', 'application/json')
    parsed = JSON.stringify(result)

    if (parsed.length > 30) {
      // depends on size
      client.res?.writeHeader(
        'ETag',
        String(
          checksum || (typeof result === 'object' && result !== null)
            ? hashObjectIgnoreKeyOrder(result)
            : hash(result)
        )
      )
    }
  }

  client.res?.writeHeader('Cache-Control', 'max-age=0, must-revalidate')

  // clean this up... just use promises
  let compressor
  if (encoding) {
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
    compressor.write(Buffer.from(parsed))
    compressor.end()
  } else {
    client.res?.end(parsed)
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
                  console.error('wrong fn', client)
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

            // client.res?.end('wrong!')
          })
      } else {
        console.error('No function for you')
        // SEND ERROR sendResponse(client, encoding, result)

        // client.res?.end('wrong!')
      }
    })
    .catch((err) => {
      console.error('fn does not exist', err)
      // SEND ERROR sendResponse(client, encoding, result)

      // client.res?.end('wrong!')
    })
}
