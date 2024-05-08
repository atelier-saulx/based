import connect, { Connection } from './socket.js'
import { crc32 } from './crc32c.js'

const SELVA_PROTO_FRAME_SIZE_MAX = 2048
const SELVA_PROTO_MSG_SIZE_MAX = 1073741824

const SELVA_PROTO_HDR_SIZE = 16
const SELVA_PROTO_HDR_FREQ_RES = 0x80 /*!< req = 0; res = 1 */
const SELVA_PROTO_HDR_FFMASK = 0x60 /*!< Mask to catch fragmentation status. */
const SELVA_PROTO_HDR_FFIRST = 0x20 /*!< This is the first frame of a sequence. */
const SELVA_PROTO_HDR_FLAST = 0x40 /*!< This is the last frame of the sequence. */
const SELVA_PROTO_HDR_STREAM = 0x10
const SELVA_PROTO_HDR_BATCH = 0x08
const SELVA_PROTO_HDR_FDEFLATE = 0x01
const SELVA_PROTO_HDR_CHECK_OFFSET = 12

function encode(cmdId: number, seqno: number, payload: Buffer | null): Buffer[] {
  const chunkSize = SELVA_PROTO_FRAME_SIZE_MAX - SELVA_PROTO_HDR_SIZE
  const frameTemplate = Buffer.allocUnsafe(SELVA_PROTO_FRAME_SIZE_MAX)

  frameTemplate.writeInt8(cmdId, 0)
  //frameTemplate.writeInt8(flags, 1)
  frameTemplate.writeUint32LE(seqno, 2)
  //frameTemplate.writeUint16LE(frame_bsize, 6)
  frameTemplate.writeUint32LE(payload?.length || 0, 8) // msg_bsize
  frameTemplate.writeUint32LE(0, SELVA_PROTO_HDR_CHECK_OFFSET) // chk must be zeroed initially

  // Some commands don't take any payload
  if (!payload || payload.length == 0) {
    frameTemplate.writeInt8(SELVA_PROTO_HDR_FFIRST | SELVA_PROTO_HDR_FLAST, 1)
    frameTemplate.writeUint16LE(16, 6) // frame_size
    frameTemplate.writeUInt32LE(crc32(frameTemplate, 0, SELVA_PROTO_HDR_SIZE), SELVA_PROTO_HDR_CHECK_OFFSET)
    return [frameTemplate]
  }

  const frames: Buffer[] = []
  for (let i = 0; i < payload.length; i += chunkSize) {
    const chunk = payload.slice(i, i + chunkSize)
    const frame = Buffer.from(frameTemplate)

    frame.writeInt8((i == 0 ? SELVA_PROTO_HDR_FFIRST : 0) | (i + chunkSize >= payload.length ? SELVA_PROTO_HDR_FLAST : 0), 1) // flags
    frame.writeUint16LE(16 + chunk.length, 6) // frame_bsize
    chunk.copy(frame, 16)
    frame.writeUInt32LE(crc32(frame, 0, 16 + chunk.length), SELVA_PROTO_HDR_CHECK_OFFSET)
    frames.push(frame)
  }

  return frames
}

export default function createSelvaProtoClient(port: number, host: string) {
  let nextSeqno = 0
  let partialIncomingBuf: null | Buffer = null
  const incoming = new Map<number, Array<Buffer>>()
  const waiting = new Map<number, (msg: Buffer | null, err?: Error) => void>()
  const conn: Connection = connect(port, host, {
    onOpen: () => {}, // TODO
    onData: (buf: Buffer) => {
        let frame: Buffer | null = partialIncomingBuf ? Buffer.concat([partialIncomingBuf, buf]) : buf
        let left = frame.length

        partialIncomingBuf = null

        do {
            const frameBsize = frame.readUint32LE(6)
            const origChk = frame.readUint32LE(SELVA_PROTO_HDR_CHECK_OFFSET)
            frame.writeUInt32LE(0, SELVA_PROTO_HDR_CHECK_OFFSET)
            const newChk = crc32(frame, 0, frameBsize)

            if (origChk != newChk) {
                // TODO Do something like reconn & retry?
                console.error(`Checksum mismatch: ${origChk} != ${newChk}`)
                return
            }

            const seqno = frame.readUint32LE(2);
            const flags = frame.readUint8(1)
            // TODO Compression support

            if (flags & SELVA_PROTO_HDR_STREAM) {
                // TODO Streaming support
            } else {
              const seq = incoming.get(seqno) || []
              seq.push(frame.subarray(SELVA_PROTO_HDR_SIZE, frameBsize))
              incoming.set(seqno, seq) // TODO optimize

              if (flags & SELVA_PROTO_HDR_FLAST) {
                  const wait = waiting.get(seqno)
                  if (wait) {
                      wait(Buffer.concat(seq))
                  } else {
                      const cmd = frame.readUint8(0)
                      console.error(`Nobody asked for this seqno: ${seqno} cmd: ${cmd}`)
                  }

                  incoming.delete(seqno)
              }
            }

            left -= SELVA_PROTO_FRAME_SIZE_MAX
            frame = frame.subarray(SELVA_PROTO_FRAME_SIZE_MAX)
        } while (left >= SELVA_PROTO_FRAME_SIZE_MAX)
        if (left) {
            partialIncomingBuf = frame
        }
    },
    onReconnect: () => { // TODO
        nextSeqno = 0
        incoming.clear()
        for (const wait of waiting.values()) {
            wait(null, new Error('EAGAIN')) // TODO ???
        }
        waiting.clear()
    },
    onClose: () => {}, // TODO
  })

  function sendRequest(cmdId: number, payload: Buffer | null): Promise<Buffer> {
    const seqno = nextSeqno++
    const bufs = encode(cmdId, seqno, payload) // TODO This is probably stupid, why doesn't it just make a single buffer?

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        for (const buf of bufs) {
          conn.socket.write(buf, (err: Error) => {
            if (err) {
              reject(err)
              return
            }
          })
        }

        waiting.set(seqno, (buf: Buffer, err?: Error) => buf ? resolve(buf) : reject(err))
      }, 0)
    })
  }

  return { sendRequest }
}
