import { isObservableFunctionSpec } from '../../functions'
import { BasedServer } from '../../server'
import { HttpClient } from '../../types'
import end from './end'
import { compress } from './compress'

const sendResponse = (client: HttpClient, encoding: string, result: any) => {
  if (!client.res) {
    return
  }

  client.res.writeStatus('200 OK')
  client.res.writeHeader('Access-Control-Allow-Origin', '*')
  client.res.writeHeader('Access-Control-Allow-Headers', 'content-type')

  // for functions there is never cache (idea is they are used to execute - observable fns are for cache)
  client.res.writeHeader('Cache-Control', 'max-age=0, must-revalidate')

  let parsed: string

  // handle response
  if (typeof result === 'string') {
    client.res.writeHeader('Content-Type', 'text/plain')
    parsed = result
    // if (parsed.length > 30) {
    // client.res.writeHeader('ETag', String(checksum || hash(parsed)))
    // }
  } else {
    client.res.writeHeader('Content-Type', 'application/json')
    parsed = JSON.stringify(result)
  }

  compress(parsed, encoding).then((p) => {
    end(client, p)
  })
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
              // client.res?.writeStatus('401 Unauthorized')
              // client.res?.end('WRONG AUTH')
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
                    // do something with headers...
                    sendResponse(client, encoding, result)
                  } else {
                    sendResponse(client, encoding, result)
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
