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

export const authMessage = (
  arr: Uint8Array,
  start: number,
  len: number,
  isDeflate: boolean,
  ws: uws.WebSocket,
  server: BasedServer
): boolean => {
  // | 4 header | 3 id | * payload |

  const reqId = readUint8(arr, start + 4, 3)
  const authPayload = decodePayload(
    new Uint8Array(arr.slice(start + 7, start + len)),
    isDeflate
  )

  if (!reqId) {
    return false
  }

  let authState
  try {
    authState = JSON.parse(authPayload)
  } catch (err) {
    console.error("can't decode auth payload", err)
  }

  // TODO: store and send response

  // server.functions
  //   .get(name)
  //   .then((spec) => {
  //     if (spec && !isObservableFunctionSpec(spec)) {
  //       spec
  //         .function(payload, ws)
  //         .then((v) => {
  //           ws.send(
  //             encodeFunctionResponse(reqId, valueToBuffer(v)),
  //             true,
  //             false
  //           )
  //         })
  //         .catch((err) => {
  //           // error handling nice
  //           console.error('bad fn', err)
  //         })
  //     } else {
  //       console.error('No function for you')
  //     }
  //   })
  //   .catch((err) => {
  //     console.error('fn does not exist', err)
  //   })

  return true
}
