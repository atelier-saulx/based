import uws from '@based/uws'
// import { isObservableFunctionSpec } from '../../functions'
import { decodePayload, decodeName, readUint8 } from '../../protocol'
import { BasedServer } from '../../server'

export const subscribeMessage = (
  arr: Uint8Array,
  start: number,
  len: number,
  isDeflate: boolean,
  ws: uws.WebSocket,
  server: BasedServer
) => {
  // | 4 header | 8 id | 8 checksum | 1 name length | * name | * payload |

  const nameLen = arr[start + 20]

  //   const id = readUint8(arr)
  const name = decodeName(arr, start + 21, start + 21 + nameLen)
  const payload = decodePayload(
    new Uint8Array(arr.slice(start + 21 + nameLen, start + len)),
    isDeflate
  )

  console.info('subscribe', name, payload)
}
