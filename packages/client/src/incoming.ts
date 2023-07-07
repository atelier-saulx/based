import { BasedDbClient } from '.'
import {
  SELVA_PROTO_HDR_FFIRST,
  SELVA_PROTO_HDR_FLAST,
  SELVA_PROTO_HDR_FREQ_RES,
  decodeMessage,
  findFrame,
} from './protocol'

const IGNORED_FIRST_BYTES = 2 * 8

let cnt = 0

export const incoming = (client: BasedDbClient, data: any /* TODO: type */) => {
  // TODO: check if the next thing starts with a frame
  if (client.backpressureBlock) {
    data = Buffer.concat([client.backpressureBlock, data])
    client.backpressureBlock = null
  }

  cnt++
  console.log(cnt, !!data)
  // TODO: collect messages and then decode it all
  if (client.isDestroyed) {
    return
  }

  let processedBytes = 0
  let nextBuf: Buffer | null = data
  const now = Date.now()
  do {
    console.log(cnt, 'NEXT BUF', nextBuf.byteLength)

    const { header, frame, rest } = findFrame(nextBuf)
    if (!frame && processedBytes + nextBuf.byteLength === data.byteLength) {
      console.log(
        'NOFRAME',
        processedBytes + nextBuf.byteLength === data.byteLength
      )
      // we have an incomplete frame (wait for more data from node event loop)
      client.backpressureBlock = nextBuf
      return
    }

    processedBytes += frame.byteLength

    console.log(cnt, 'HEADER')
    nextBuf = rest
    console.log('LOL', cnt)

    if (!(header.flags & SELVA_PROTO_HDR_FREQ_RES)) {
      // TODO: error and clean up
      return
    }

    // TODO: handle subscriptions (stream shit)

    if (
      header.flags & SELVA_PROTO_HDR_FFIRST &&
      header.flags & SELVA_PROTO_HDR_FLAST
    ) {
      const msg = frame.subarray(IGNORED_FIRST_BYTES)

      const [resolve, reject] = client.commandResponseListeners.get(
        header.seqno
      )

      client.incomingMessageBuffers.delete(header.seqno)
      client.commandResponseListeners.delete(header.seqno)

      const [parsed] = decodeMessage(msg, -1)
      if (parsed[0] instanceof Error) {
        reject(parsed[0])
      } else {
        resolve(parsed)
      }

      continue
    }

    let incoming
    if (!client.incomingMessageBuffers.has(header.seqno)) {
      incoming = {
        ts: now,
        bufs: [frame.subarray(IGNORED_FIRST_BYTES)],
      }

      client.incomingMessageBuffers.set(header.seqno, incoming)
    }

    if (!incoming) {
      incoming = client.incomingMessageBuffers.get(header.seqno)
    }

    incoming.ts = now
    if (header.flags & SELVA_PROTO_HDR_FFIRST) {
      incoming.bufs = [frame.subarray(IGNORED_FIRST_BYTES)]
    } else {
      incoming.bufs.push(frame.subarray(IGNORED_FIRST_BYTES))
    }

    if (header.flags & SELVA_PROTO_HDR_FLAST) {
      console.log('LAST FRAME', header, frame)
      const msg = Buffer.concat(incoming.bufs)
      const [resolve, reject] = client.commandResponseListeners.get(
        header.seqno
      )
      client.incomingMessageBuffers.delete(header.seqno)
      client.commandResponseListeners.delete(header.seqno)

      const [parsed] = decodeMessage(msg, -1)
      if (parsed[0] instanceof Error) {
        reject(parsed[0])
      } else {
        resolve(parsed)
      }

      continue
    }
  } while (nextBuf)
}
