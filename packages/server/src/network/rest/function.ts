import { isObservableFunctionSpec } from '../../functions'
import { BasedServer } from '../../server'
import { RestClient } from '../../types'

export const functionRest = (
  name: string,
  payload?: any,
  isDeflate: boolean, // lets add this ad well...
  client: RestClient,
  server: BasedServer
): boolean => {
  // server.auth.config
  //   .authorize(server, ws, 'function', name, payload)
  //   .then((ok) => {
  //     if (!ok) {
  //       fail(ws, reqId)
  //       return false
  //     }
  server.functions
    .get(name)
    .then((spec) => {
      if (spec && !isObservableFunctionSpec(spec)) {
        spec
          .function(payload, client)
          .then((v) => {
            // typeof v === object

            if (typeof v === 'string') {
              client.res.end(v)
            } else {
              client.res.end(JSON.stringify(v))
            }

            // ws.send(
            //   encodeFunctionResponse(reqId, valueToBuffer(v)),
            //   true,
            //   false
            // )
          })
          .catch((err) => {
            // error handling nice
            console.error('bad fn', err)
          })
      } else {
        console.error('No function for you')
        client.res.end('wrong!')
      }
    })
    .catch((err) => {
      console.error('fn does not exist', err)
      client.res.end('wrong!')
    })

  // .catch((err) => {
  //   console.log({ err })
  //   fail(ws, reqId)
  //   return false
  // })

  return true
}
