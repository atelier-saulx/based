import { BasedDbClient } from '.'
import {
  SELVA_PROTO_HDR_FFIRST,
  SELVA_PROTO_HDR_FLAST,
  SELVA_PROTO_HDR_FREQ_RES,
  decodeMessage,
  findFrame,
} from './protocol'

const IGNORED_FIRST_BYTES = 2 * 8

export const incoming = async (
  client: BasedDbClient,
  data: any /* TODO: type */
) => {
  // TODO: collect messages and then decode it all
  console.log('luzzzl', data)
  if (client.isDestroyed) {
    return
  }

  let nextBuf = data
  const now = Date.now()
  do {
    const { header, frame, rest } = findFrame(nextBuf)
    nextBuf = rest

    if (!(header.flags & SELVA_PROTO_HDR_FREQ_RES)) {
      console.info('Look weird flags', header, frame)
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

  const id = 0 // SEQ ID
  const payload = 0
  try {
    if (client.commandResponseListeners.has(id)) {
      client.commandResponseListeners.get(id)[0](payload)
      client.commandResponseListeners.delete(id)
    }
    // ---------------------------------
  } catch (err) {
    console.error('Error parsing incoming data', err)
  }
}
