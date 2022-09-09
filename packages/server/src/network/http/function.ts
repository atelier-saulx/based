import { isObservableFunctionSpec } from '../../functions'
import { BasedServer } from '../../server'
import { HttpClient } from '../../types'

export const functionRest = (
  name: string,
  payload: any,
  isDeflate: boolean, // lets add this ad well...
  client: HttpClient,
  server: BasedServer
): void => {
  console.info('go fn', isDeflate)

  server.functions
    .get(name)
    .then((spec) => {
      if (client.isAborted) {
        return
      }
      if (spec && !isObservableFunctionSpec(spec)) {
        server.auth.config
          .authorize(server, client, 'function', name, payload)
          .then((ok) => {
            if (client.isAborted) {
              return
            }
            if (!ok) {
              client.res?.writeStatus('401 Unauthorized')
              client.res?.end('WRONG AUTH')
            } else {
              spec
                .function(payload, client)
                .then(async (result) => {
                  if (client.isAborted) {
                    return
                  }
                  if (spec.customHttpResponse) {
                    if (
                      await spec.customHttpResponse(result, payload, client)
                    ) {
                      // if true all is handled
                      return
                    }
                    if (client.isAborted) {
                      return
                    }
                  }
                  // handle response
                  if (typeof result === 'string') {
                    client.res?.end(result)
                  } else {
                    client.res?.end(JSON.stringify(result))
                  }
                })
                .catch((err) => {
                  if (client.isAborted) {
                    return
                  }
                  // error handling nice
                  console.error('bad fn', client.id, client.isAborted, err)
                  client.res?.end('wrong!')
                })
            }
          })
          .catch((err) => {
            if (client.isAborted) {
              return
            }
            console.error('no auth', err)
            client.res?.end('wrong!')
          })
      } else {
        console.error('No function for you')
        client.res?.end('wrong!')
      }
    })
    .catch((err) => {
      console.error('fn does not exist', err)
      client.res?.end('wrong!')
    })
}
