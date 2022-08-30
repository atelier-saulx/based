import zlib from 'zlib'
import uws from '@based/uws'
import { isObservableFunctionSpec } from '../../functions'
import {
  readUint8,
  valueToBuffer,
  encodeFunctionResponse,
} from '../../protocol'
import { BasedServer } from '../../server'

const textDecoder = new TextDecoder()

export const functionMessage = (
  arr: Uint8Array,
  start: number,
  len: number,
  isDeflate: boolean,
  ws: uws.WebSocket,
  server: BasedServer
) => {
  const reqId = readUint8(arr, start + 4, 3)
  const namelen = arr[7]
  const name = new Uint8Array(arr.slice(start + 8, start + 8 + namelen))
  const nameParsed = textDecoder.decode(name)
  const payload = new Uint8Array(arr.slice(start + 8 + namelen, start + len))
  let p
  if (!isDeflate) {
    p = textDecoder.decode(payload)
  } else {
    const buffer = zlib.inflateRawSync(payload)
    p = textDecoder.decode(buffer)
  }

  console.info(nameParsed, isDeflate, p)

  server.functions
    .get(nameParsed)
    .then((spec) => {
      if (spec && !isObservableFunctionSpec(spec)) {
        spec
          .function(p, ws)
          .then((v) => {
            ws.send(encodeFunctionResponse(reqId, valueToBuffer(v)), true)
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
}
