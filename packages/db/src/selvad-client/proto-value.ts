import {
  SELVA_PROTO_ARRAY,
  SELVA_PROTO_ARRAY_END,
  SELVA_PROTO_ARRAY_FDOUBLE,
  SELVA_PROTO_ARRAY_FLONGLONG,
  SELVA_PROTO_ARRAY_FPOSTPONED_LENGTH,
  SELVA_PROTO_STRING_FBINARY,
  selvaError,
} from './selva_proto.js'

type ParserFn = (buf: Buffer) => [any, number]

enum ValueType {
  null = 0,
  error = 1,
  double = 2,
  longlong = 3,
  string = 4,
  array = 5,
  array_end = 6,
  replication_cmd = 7,
  replication_sdb = 8,
}

const VALUE_PARSERS: Record<ValueType, ParserFn> = {
  [ValueType.null]: (_buf) => {
    return [null, 1]
  },
  [ValueType.error]: (buf) => {
    const code = buf.readUint16LE(2)
    const msgLen = buf.readUint16LE(4)
    const msg = buf.subarray(6, 6 + msgLen)

    const err = new Error(msg.toString('utf8'))
    // @ts-ignore
    err.code = selvaError[-code] || code

    return [err, 8 + msgLen]
  },
  [ValueType.double]: (buf) => {
    return [buf.readDoubleLE(8), 16]
  },
  [ValueType.longlong]: (buf) => {
    return [buf.readBigUint64LE(8), 16]
  },
  [ValueType.string]: (buf) => {
    const flags = buf.readInt8(1)
    const dataLen = buf.readUint32LE(4)
    const data = buf.subarray(8, 8 + dataLen)
    /* TODO support deflate */
    return [
      flags & SELVA_PROTO_STRING_FBINARY ? data : data.toString('utf8'),
      8 + dataLen,
    ]
  },
  [ValueType.array]: (buf) => {
    const flags = buf.readInt8(1)
    const length = buf.readUint32LE(4)
    return [{ type: SELVA_PROTO_ARRAY, flags, length }, 8]
  },
  [ValueType.array_end]: (buf) => {
    return [{ type: SELVA_PROTO_ARRAY_END }, 8]
  },
  [ValueType.replication_cmd]: (_buf) => {
    throw new Error('ENOTSUP')
  },
  [ValueType.replication_sdb]: (_buf) => {
    throw new Error('ENOTSUP')
  },
  // TODO There are even more types
}

export function decodeMessageWithValues(buf: Buffer, n: number = buf.length): [any, Buffer | null] {
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
        const [r, newRest] = decodeMessageWithValues(rest, -2)

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
        const [r, newRest] = decodeMessageWithValues(rest, v.length)
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
