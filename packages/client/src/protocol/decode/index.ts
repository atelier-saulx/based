import { deserialize } from 'data-record'
import {
  SELVA_PROTO_ARRAY,
  SELVA_PROTO_ARRAY_END,
  SELVA_PROTO_ARRAY_FDOUBLE,
  SELVA_PROTO_ARRAY_FLONGLONG,
  SELVA_PROTO_ARRAY_FPOSTPONED_LENGTH,
  SELVA_PROTO_CHECK_OFFSET,
  SelvaProtocolHeader,
  selva_proto_header_def as selvaProtoHeaderDef,
} from '../types.js'
import { crc32 } from '../crc32c.js'
import { VALUE_PARSERS } from './valueParsers.js'

export function findFrame(buf: Buffer): {
  header: SelvaProtocolHeader
  frame: Buffer | null
  rest: Buffer
} {
  const header: SelvaProtocolHeader = deserialize(selvaProtoHeaderDef, buf)

  const frame = buf.subarray(0, header.frame_bsize)
  const origChk = frame.readInt32LE(SELVA_PROTO_CHECK_OFFSET)

  frame.writeUInt32LE(0, SELVA_PROTO_CHECK_OFFSET)
  const compChk = crc32(frame, 0) | 0

  if (origChk !== compChk) {
    frame.writeInt32LE(origChk, SELVA_PROTO_CHECK_OFFSET)
    return {
      header,
      frame: null,
      rest:
        header.frame_bsize < buf.length
          ? buf.subarray(header.frame_bsize)
          : null,
    }
  }

  return {
    header,
    frame,
    rest:
      header.frame_bsize < buf.length ? buf.subarray(header.frame_bsize) : null,
  }
}

export function decodeMessage(buf: Buffer, n: number): [any, Buffer | null] {
  if (!buf || buf.length === 0 || n === 0) {
    return [[], null]
  }

  const result = []
  let rest: Buffer | null = buf
  do {
    let v: any
    ;[v, rest] = parseValue(rest)

    if (v?.type === SELVA_PROTO_ARRAY) {
      if (v.flags & SELVA_PROTO_ARRAY_FPOSTPONED_LENGTH) {
        const [r, newRest] = decodeMessage(rest, -2)

        result.push(r)
        rest = newRest
      } else if (v.flags & SELVA_PROTO_ARRAY_FLONGLONG) {
        const a = []
        for (let i = 0; i < v.length; i++) {
          a.push(rest.readBigInt64LE(i * 8))
        }
        result.push(a)
        rest = rest.slice(v.length * 8)
      } else if (v.flags & SELVA_PROTO_ARRAY_FDOUBLE) {
        const a = []
        for (let i = 0; i < v.length; i++) {
          a.push(rest.readDoubleLE(i * 8))
        }
        result.push(a)
        rest = rest.slice(v.length * 8)
      } else {
        /* Read v.length values */
        const [r, newRest] = decodeMessage(rest, v.length)
        if (r.length !== v.length) {
          throw new Error(`Invalid array size: ${r.length} != ${v.length}`)
        }

        result.push(r)
        rest = newRest
      }
    } else if (v?.type === SELVA_PROTO_ARRAY_END) {
      if (n !== -2) {
        throw new Error('Unexpected SELVA_PROTO_ARRAY_END')
      }
      break
    } else {
      result.push(v)
    }

    if (n > 0) {
      n--
    }
  } while (rest && n)

  return [result, rest]
}

export function parseValue(buf: Buffer): [any, Buffer | null] {
  const type = buf.readUInt8(0)
  const parser = VALUE_PARSERS[type]
  if (!parser) {
    throw new Error(`Invalid type: ${type}`)
  }

  const [v, vsize] = parser(buf)
  return [v, vsize < buf.length ? buf.subarray(vsize) : null]
}
