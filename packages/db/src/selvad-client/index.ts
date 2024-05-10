import connect, { Connection } from './socket.js'
import { crc32 } from './crc32c.js'

const SELVA_PROTO_FRAME_SIZE = 2048
const SELVA_PROTO_MSG_SIZE_MAX = 1073741824

const SELVA_PROTO_HDR_SIZE = 16
const SELVA_PROTO_HDR_FREQ_RES = 0x80 /*!< req = 0; res = 1 */
const SELVA_PROTO_HDR_FFMASK = 0x60 /*!< Mask to catch fragmentation status. */
const SELVA_PROTO_HDR_FFIRST = 0x20 /*!< This is the first frame of a sequence. */
const SELVA_PROTO_HDR_FLAST = 0x40 /*!< This is the last frame of the sequence. */
const SELVA_PROTO_HDR_STREAM = 0x10
const SELVA_PROTO_HDR_BATCH = 0x08
const SELVA_PROTO_HDR_FDEFLATE = 0x01

const HDR_OFF_CMDID = 0
const HDR_OFF_FLAGS = 1
const HDR_OFF_SEQNO = 2
const HDR_OFF_FBSIZE = 6
const HDR_OFF_CHK = 12

export function buf2payloadChunks(buf: Buffer, hdrSize?: number): Buffer[] {
  const chunkSize = SELVA_PROTO_FRAME_SIZE - SELVA_PROTO_HDR_SIZE
  const chunks: Buffer[] = []
  let i = 0

  if (hdrSize) {
    const size = chunkSize - hdrSize
    const chunk = buf.subarray(0, size)
    chunks.push(chunk)
    i = size
  }

  for (; i < buf.length; i += chunkSize) {
    const chunk = buf.subarray(i, i + chunkSize)
    chunks.push(chunk)
  }

  return chunks
}

function iniFrame(frame: Buffer, cmdId: number, seqno: number) {
  frame.writeInt8(cmdId, HDR_OFF_CMDID)
  frame.writeInt8(0, HDR_OFF_FLAGS)
  frame.writeUint32LE(seqno, HDR_OFF_SEQNO)
  frame.writeUint32LE(0, HDR_OFF_CHK) // chk must be zeroed initially
}

export default function createSelvaProtoClient(port: number, host: string) {
  const outgoingBuf = Buffer.allocUnsafe(100 * 1024 * 1024)
  let outgoingBufIndex = 0
  let nextSeqno = 0
  let partialIncomingBuf: null | Buffer = null
  const incoming = new Map<number, Array<Buffer>>()
  const waiting = new Map<number, (msg: Buffer | null, err?: Error) => void>()
  const conn: Connection = connect(port, host, {
    onOpen: () => {
        maybeSendAll(true)
    },
    onData: (buf: Buffer) => {
        let frame: Buffer | null = partialIncomingBuf ? Buffer.concat([partialIncomingBuf, buf]) : buf
        let left = frame.length

        partialIncomingBuf = null

        do {
            const frameBsize = frame.readUint32LE(6)
            const origChk = frame.readUint32LE(HDR_OFF_CHK)
            frame.writeUInt32LE(0, HDR_OFF_CHK)
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

            left -= SELVA_PROTO_FRAME_SIZE
            frame = frame.subarray(SELVA_PROTO_FRAME_SIZE)
        } while (left >= SELVA_PROTO_FRAME_SIZE)
        if (left) {
            partialIncomingBuf = frame
        }
    },
    onReconnect: () => { // TODO
        outgoingBufIndex = 0
        nextSeqno = 0
        incoming.clear()
        for (const wait of waiting.values()) {
            wait(null, new Error('EAGAIN')) // TODO ???
        }
        waiting.clear()
    },
    onClose: () => {}, // TODO
  })

  const maybeSendAll = async (flush?: boolean) => {
    return new Promise<boolean>((resolve, reject) => {
      if (conn.disconnected || !conn.socket) {
          console.log('Not connected') // TODO ???
          resolve(false)
      } else if (flush || outgoingBufIndex + SELVA_PROTO_FRAME_SIZE >= outgoingBuf.length) {
        conn.socket.write(outgoingBuf.subarray(0, outgoingBufIndex), (err: Error) => {
            if (err) {
              // TODO fail those seqs that were waiting
              reject(err)
            } else {
              outgoingBufIndex = 0
              resolve(true)
            }
        })
      }
    })
  }

  const newSeqno = (): number => nextSeqno++

  const newFrame = async (cmdId: number, seqno: number): Promise<[Buffer, Buffer]> => {
    do {
        if (await maybeSendAll(true)) break
    } while (outgoingBufIndex)

    const start = outgoingBufIndex + SELVA_PROTO_HDR_SIZE
    const end = outgoingBufIndex + SELVA_PROTO_FRAME_SIZE
    const frame = outgoingBuf.subarray(outgoingBufIndex, end)
    const payload = outgoingBuf.subarray(start, end)
    outgoingBufIndex += SELVA_PROTO_FRAME_SIZE

    iniFrame(frame, cmdId, seqno)
    return [frame, payload]
  }

  const frameCRC = (frame: Buffer) => {
    frame.writeUInt32LE(0, HDR_OFF_CHK)
    frame.writeUInt32LE(crc32(frame, 0, frame.readUint16LE(HDR_OFF_FBSIZE)), HDR_OFF_CHK)
  }

  const finiFrame = (frame: Buffer, len: number, flags?: { firstFrame?: boolean; lastFrame?: boolean; batch?: boolean; }) => {
    frame.writeUint8(frame.readUint8(HDR_OFF_FLAGS)
      | (flags?.firstFrame ? SELVA_PROTO_HDR_FFIRST : 0)
      | (flags?.lastFrame ? SELVA_PROTO_HDR_FLAST : 0)
      | (flags?.batch ? SELVA_PROTO_HDR_BATCH : 0), HDR_OFF_FLAGS)
    frame.writeUint16LE(SELVA_PROTO_HDR_SIZE + len, HDR_OFF_FBSIZE)
    frameCRC(frame)
  }

  const sendFrame = (frame: Buffer, len: number, flags: { firstFrame?: boolean; lastFrame?: boolean; batch?: boolean; }): Promise<Buffer> | null => {
    finiFrame(frame, len, flags)

    const p = flags?.lastFrame ? new Promise<Buffer>((resolve, reject) =>
        waiting.set(frame.readUint32LE(HDR_OFF_SEQNO),
                    (buf: Buffer, err?: Error) => buf ? resolve(buf) : reject(err))) : null
    maybeSendAll(!flags?.batch).catch(console.error) // TODO
    return p
  }

  const sendPing = async () => {
    const seqno = newSeqno()
    const [frame] = await newFrame(0, seqno)
    await sendFrame(frame, 0, { firstFrame: true, lastFrame: true, batch: false })
  }

  const flush = async () => {
    const lastFrame = outgoingBuf.subarray(outgoingBufIndex - SELVA_PROTO_FRAME_SIZE);
    lastFrame.writeUint8(lastFrame.readUint8(HDR_OFF_FLAGS) & ~SELVA_PROTO_HDR_BATCH, HDR_OFF_FLAGS)
    frameCRC(lastFrame)
    await sendPing()
  }

  return { newSeqno, newFrame, sendFrame, flush }
}
