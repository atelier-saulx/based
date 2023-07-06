import { serialize } from 'data-record'
import {
  Command,
  SELVA_PROTO_HDR_FFIRST,
  SELVA_PROTO_HDR_FLAST,
  SELVA_PROTO_CHECK_OFFSET,
  TYPES,
  selva_proto_header_def,
  SELVA_PROTO_FRAME_SIZE_MAX,
} from './types'
import { crc32 } from './crc32c'

// TODO: split frames by payload size etc.
export function encode(cmd: Command, seqno: number, payload: any): Buffer {
  if (TYPES[cmd] === undefined) {
    throw new Error(`Unknown command: ${cmd}`)
  }

  // TODO: encoding, only ping works
  const buf = null
  const chunkSize = SELVA_PROTO_FRAME_SIZE_MAX - selva_proto_header_def.size

  // Some commands don't take any payload
  if (!buf || buf.length == 0) {
    const frame = Buffer.allocUnsafe(selva_proto_header_def.size)

    serialize(selva_proto_header_def, frame, {
      cmd: TYPES[cmd],
      flags: SELVA_PROTO_HDR_FFIRST | SELVA_PROTO_HDR_FLAST,
      seqno,
      frame_bsize: frame.length,
      msg_bsize: 0,
      chk: 0,
    })
    frame.writeUInt32LE(crc32(frame, 0), SELVA_PROTO_CHECK_OFFSET)
    return frame
  }

  if (buf.length > SELVA_PROTO_FRAME_SIZE_MAX) {
    throw new Error('Message too big')
  }

  for (let i = 0; i < buf.length; i += chunkSize) {
    const chunk = buf.slice(i, i + chunkSize)
    const frame = Buffer.allocUnsafe(selva_proto_header_def.size + chunk.length)

    let flags
    flags |= i == 0 ? SELVA_PROTO_HDR_FFIRST : 0
    flags |= i + chunkSize >= buf.length ? SELVA_PROTO_HDR_FLAST : 0

    serialize(selva_proto_header_def, frame, {
      cmd: TYPES[cmd],
      flags,
      seqno,
      frame_bsize: frame.length,
      msg_bsize: buf.length,
      chk: 0,
    })
    chunk.copy(frame, selva_proto_header_def.size)
    frame.writeUInt32LE(crc32(frame, 0), SELVA_PROTO_CHECK_OFFSET)

    return frame
  }
}
