import { isObservableFunctionSpec } from '../../functions'
import { BasedServer } from '../../server'
import { HttpClient } from '../../types'
import end from './end'
import { compress } from './compress'
import { sendError } from './sendError'

const sendResponse = (client: HttpClient, encoding: string, result: any) => {
  if (!client.res) {
    return
  }

  client.res.writeStatus('200 OK')

  // for functions there is never cache (idea is they are used to execute - observable fns are for cache)
  client.res.writeHeader('Cache-Control', 'max-age=0, must-revalidate')

  let parsed: string

  if (typeof result === 'string') {
    client.res.writeHeader('Content-Type', 'text/plain')
    parsed = result
  } else {
    client.res.writeHeader('Content-Type', 'application/json')
    parsed = JSON.stringify(result)
  }

  compress(client, parsed, encoding).then((p) => end(client, p))
}

export const httpFunction = (
  name: string,
  payload: any,
  client: HttpClient,
  server: BasedServer
): void => {
  if (!client.res) {
    return
  }

  const encoding = client.context.encoding

  server.functions
    .install(name)
    .then((spec) => {
      if (!client.res) {
        return
      }
      if (spec && !isObservableFunctionSpec(spec)) {
        server.auth.config
          .authorize(server, client, name, payload)
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
              spec
                .function(payload, client)
                .then(async (result) => {
                  if (!client.res) {
                    return
                  }
                  if (spec.customHttpResponse) {
                    if (
                      await spec.customHttpResponse(result, payload, client)
                    ) {
                      return
                    }
                    sendResponse(client, encoding, result)
                  } else {
                    sendResponse(client, encoding, result)
                  }
                })
                .catch((err) => {
                  sendError(client, err.message)
                })
            }
          })
          .catch((err) => sendError(client, err.message, 401, 'Unauthorized'))
      } else if (spec && isObservableFunctionSpec(spec)) {
        sendError(
          client,
          `function is observable - use /get/${name} instead`,
          404,
          'Not Found'
        )
      } else {
        sendError(client, `function does not exist ${name}`, 404, 'Not Found')
      }
    })
    .catch(() =>
      sendError(client, `function does not exist ${name}`, 404, 'Not Found')
    )
}
