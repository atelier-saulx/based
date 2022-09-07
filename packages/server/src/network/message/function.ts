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
import { sendError, BasedErrorCode } from '../../error'

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
        if (!ws.closed) {
          sendError(ws, 'Not authorized', {
            basedCode: BasedErrorCode.AuthorizeRejectedError,
            requestId: reqId,
          })
        }
        return false
      }
      server.functions
        .get(name)
        .then((spec) => {
          if (spec && !isObservableFunctionSpec(spec)) {
            spec
              .function(payload, ws)
              .then((v) => {
                // have to check if its closed.. EVERYWHERE

                if (!ws.closed) {
                  ws.send(
                    encodeFunctionResponse(reqId, valueToBuffer(v)),
                    true,
                    false
                  )
                }
              })
              .catch((err) => {
                sendError(ws, err, {
                  basedCode: BasedErrorCode.FunctionError,
                  requestId: reqId,
                })
              })
          } else {
            sendError(ws, 'No function for you', {
              basedCode: BasedErrorCode.FunctionNotFound,
              requestId: reqId,
            })
          }
        })
        .catch((_err) => {
          // console.error('fn does not exist', err)
          sendError(ws, 'fn does not exist', {
            basedCode: BasedErrorCode.FunctionNotFound,
            requestId: reqId,
          })
        })
    })
    .catch((err) => {
      if (!ws.closed) {
        sendError(ws, err, {
          basedCode: BasedErrorCode.AuthorizeError,
          requestId: reqId,
        })
      }
      return false
    })

  return true
}
