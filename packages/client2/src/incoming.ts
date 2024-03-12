import { BasedDbClient } from './index.js'
import {
  SELVA_PROTO_HDR_FFIRST,
  SELVA_PROTO_HDR_FLAST,
  SELVA_PROTO_HDR_FREQ_RES,
  SELVA_PROTO_HDR_STREAM,
  decodeMessage,
  findFrame,
} from './protocol/index.js'

const IGNORED_FIRST_BYTES = 2 * 8

export const incoming = (client: BasedDbClient, data: any /* TODO: type */) => {
  if (client.backpressureBlock) {
    data = Buffer.concat([client.backpressureBlock, data])
    client.backpressureBlock = null
  }

  if (client.isDestroyed) {
    return
  }

  let processedBytes = 0
  let nextBuf: Buffer | null = data
  const now = Date.now()
  do {
    let res
    try {
      res = findFrame(nextBuf)
    } catch (e) {
      client.backpressureBlock = nextBuf
      return
    }

    const { header, frame, rest } = res
    if (!frame && processedBytes + nextBuf.byteLength === data.byteLength) {
      // we have an incomplete frame (wait for more data from node event loop)
      client.backpressureBlock = nextBuf
      return
    }

    processedBytes += frame.byteLength

    nextBuf = rest

    if (!(header.flags & SELVA_PROTO_HDR_FREQ_RES)) {
      // TODO: error and clean up
      return
    }

    if (header.flags & SELVA_PROTO_HDR_STREAM) {
      const chId = client.subscriptionHandlers.get(header.seqno)
      if (chId !== undefined) {
        const msg = frame.subarray(IGNORED_FIRST_BYTES)
        let parsed: any

        try {
          ;[parsed] = decodeMessage(msg, -1)
        } catch (e) {
          console.error('Error decoding stream message payload', e)
          continue
        }

        client.emit('pubsub', [chId, parsed])
        continue
      }
    }

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

      try {
        const [parsed] = decodeMessage(msg, -1)
        const err = parsed.find((x: any) => {
          return x instanceof Error
        })
        if (err) {
          reject(err)
        } else {
          resolve(parsed)
        }
      } catch (e) {
        reject(e)
      }

      continue
    }

    let incoming: any
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
      const msg = Buffer.concat(incoming.bufs)
      const [resolve, reject] = client.commandResponseListeners.get(
        header.seqno
      )
      client.incomingMessageBuffers.delete(header.seqno)
      client.commandResponseListeners.delete(header.seqno)

      const [parsed] = decodeMessage(msg, -1)
      const err = parsed.find((x: any) => {
        return x instanceof Error
      })
      if (err) {
        reject(err)
      } else {
        resolve(parsed)
      }

      continue
    }
  } while (nextBuf)
}
