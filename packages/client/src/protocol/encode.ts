import { serialize } from 'data-record'
import {
  Command,
  SELVA_PROTO_HDR_FFIRST,
  SELVA_PROTO_HDR_FLAST,
  SELVA_PROTO_CHECK_OFFSET,
  TYPES,
  selva_proto_header_def,
} from './types'
import { crc32 } from './crc32c'

// TODO: split frames by payload size etc.
export function encode(cmd: Command, seqno: number, payload: any): Buffer {
  if (TYPES[cmd] === undefined) {
    throw new Error(`Unknown command: ${cmd}`)
  }

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
