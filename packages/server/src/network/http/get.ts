import { isObservableFunctionSpec } from '../../functions'
import { BasedServer } from '../../server'
import { HttpClient } from '../../types'
import end from './end'
// import { compress } from './compress'
import { sendError } from './sendError'
import { hashObjectIgnoreKeyOrder } from '@saulx/hash'

// for observe and get
// if (parsed.length > 30) {
// depends on size
// client.res.writeHeader(
//   'ETag',
//   String(
//     checksum || (typeof result === 'object' && result !== null)
//       ? hashObjectIgnoreKeyOrder(result)
//       : hash(result)
//   )
// )
// }
// import { hash, hashObjectIgnoreKeyOrder } from '@saulx/hash'

// HTTP status code 304 (Not Modified).  if none match
// The If-Match dont rly know

// if (path[1] === 'get') {
// Sending either If-Match or If-None-Match
// only relevant for get

/*
// if (parsed.length > 30) {
    // client.res.writeHeader('ETag', String(checksum || hash(parsed)))
    // }


        // if (/^<!DOCTYPE/.test(result)) {
    //   // maybe a bit more checks...
    //   client.res.writeHeader('Content-Type', 'text/html')
    // } else {
            // }

*/

// const sendResponse = (client: HttpClient, encoding: string, result: any) => {
//   if (!client.res) {
//     return
//   }

//   client.res.writeStatus('200 OK')
//   client.res.writeHeader('Access-Control-Allow-Origin', '*')
//   client.res.writeHeader('Access-Control-Allow-Headers', 'content-type')

//   // for functions there is never cache (idea is they are used to execute - observable fns are for cache)
//   client.res.writeHeader('Cache-Control', 'max-age=0, must-revalidate')

//   let parsed: string

//   if (typeof result === 'string') {
//     client.res.writeHeader('Content-Type', 'text/plain')
//     parsed = result
//   } else {
//     client.res.writeHeader('Content-Type', 'application/json')
//     parsed = JSON.stringify(result)
//   }

//   compress(parsed, encoding).then((p) => end(client, p))
// }

/*
 if (server.activeObservablesById.has(id)) {
    const obs = server.activeObservablesById.get(id)
    if (obs.beingDestroyed) {
      clearTimeout(obs.beingDestroyed)
      obs.beingDestroyed = null
    }
    if (obs.cache) {
      sendGetData(server, id, obs, checksum, client)
    } else {
      if (!obs.onNextData) {
        obs.onNextData = new Set()
      }
      obs.onNextData.add(() => {
        sendGetData(server, id, obs, checksum, client)
      })
    }
  } else {
    server.functions
      .get(name)
      .then((spec) => {
        if (spec && isObservableFunctionSpec(spec)) {
          const obs = create(server, name, id, payload)
          if (!client.ws?.obs.has(id)) {
            if (!obs.onNextData) {
              obs.onNextData = new Set()
            }
            obs.onNextData.add(() => {
              sendGetData(server, id, obs, checksum, client)
            })
          }
        } else {
          console.error('No function for you', name)
        }
      })
      .catch((err) => {
        console.error('fn does not exist', err)
      })
  }

*/

export const httpGet = (
  name: string,
  payload: any,
  encoding: string,
  client: HttpClient,
  server: BasedServer
): void => {
  server.functions
    .get(name)
    .then((spec) => {
      if (!client.res) {
        return
      }
      if (spec && isObservableFunctionSpec(spec)) {
        server.auth.config
          .authorize(server, client, 'observe', name, payload)
          .then((ok) => {
            if (!client.res) {
              return
            }
            if (!ok) {
              sendError(
                client,
                `${name} unauthorized request`,
                401,
                'Unauthorized'
              )
            } else {
              console.info('go go go GET')
              console.info(name, payload)

              const id = hashObjectIgnoreKeyOrder([name, payload])

              end(client, 'bla! ' + id)
              // do something get!
            }
          })
          .catch((err) => sendError(client, err.message, 401, 'Unauthorized'))
      } else if (spec && isObservableFunctionSpec(spec)) {
        sendError(
          client,
          `function is not observable - use /function/${name} instead`,
          404,
          'Not Found'
        )
      } else {
        sendError(
          client,
          `observable function does not exist ${name}`,
          404,
          'Not Found'
        )
      }
    })
    .catch(() =>
      sendError(
        client,
        `observable function does not exist ${name}`,
        404,
        'Not Found'
      )
    )
}
