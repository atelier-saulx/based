import uws from '@based/uws'
import { isObservableFunctionSpec } from '../../functions'
import {
  readUint8,
  valueToBuffer,
  encodeFunctionResponse,
  decodePayload,
  decodeName,
} from '../../protocol'
import { BasedServer } from '../../server'

const fail = (ws: uws.WebSocket, reqId: number) => {
  ws.send(
    encodeFunctionResponse(reqId, valueToBuffer({ error: 'this is an error' })),
    true,
    false
  )
}

export const functionMessage = (
  arr: Uint8Array,
  start: number,
  len: number,
  isDeflate: boolean,
  ws: uws.WebSocket,
  server: BasedServer
): boolean => {
  // | 4 header | 3 id | 1 name length | * name | * payload |

  const reqId = readUint8(arr, start + 4, 3)
  const nameLen = arr[start + 7]
  const name = decodeName(arr, start + 8, start + 8 + nameLen)
  const payload = decodePayload(
    new Uint8Array(arr.slice(start + 8 + nameLen, start + len)),
    isDeflate
  )

  if (!name || !reqId) {
    return false
  }

  server.auth.config
    .authorize(server, ws, 'function', name, payload)
    .then((ok) => {
      if (!ok) {
        fail(ws, reqId)
        return false
      }
      server.functions
        .get(name)
        .then((spec) => {
          if (spec && !isObservableFunctionSpec(spec)) {
            spec
              .function(payload, ws)
              .then((v) => {
                ws.send(
                  encodeFunctionResponse(reqId, valueToBuffer(v)),
                  true,
                  false
                )
              })
              .catch((err) => {
                // error handling nice
                console.error('bad fn', err)
              })
          } else {
            console.error('No function for you')
          }
        })
        .catch((err) => {
          console.error('fn does not exist', err)
        })
    })
    .catch((err) => {
      console.log({ err })
      fail(ws, reqId)
      return false
    })

  return true
}
