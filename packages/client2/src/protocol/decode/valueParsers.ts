import {
  SELVA_PROTO_STRING_FBINARY,
  selva_proto_array_def,
  selva_proto_control_def,
  selva_proto_double_def,
  selva_proto_error_def,
  selva_proto_longlong_def,
  selva_proto_null_def,
  selva_proto_string_def,
  selvaError,
} from '../types.js'
import { deserialize } from 'data-record'

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

export const VALUE_PARSERS: Record<ValueType, ParserFn> = {
  [ValueType.null]: (_buf) => {
    return [null, selva_proto_null_def.size]
  },
  [ValueType.error]: (buf) => {
    const def = selva_proto_error_def
    const v = deserialize(def, buf)
    const msg_end = def.size + v.bsize
    const msg = buf.slice(def.size, msg_end).toString('utf8')

    const err = new Error(msg)
    // @ts-ignore
    err.code = selvaError[-v.err_code] || v.err_code

    return [err, msg_end]
  },
  [ValueType.double]: (buf) => {
    const def = selva_proto_double_def
    const v = deserialize(def, buf)
    return [v.v, def.size]
  },
  [ValueType.longlong]: (buf) => {
    const def = selva_proto_longlong_def
    const v = deserialize(def, buf)
    return [v.v, def.size]
  },
  [ValueType.string]: (buf) => {
    const def = selva_proto_string_def
    const v = deserialize(def, buf)
    const data_end = def.size + v.bsize
    const data = buf.slice(def.size, data_end)
    /*
     * TODO support deflate (v.flags & SELVA_PROTO_STRING_FDEFLATE)
     * | u32 size | deflate stream |
     */
    return [
      v.flags & SELVA_PROTO_STRING_FBINARY ? data : data.toString('utf8'),
      data_end,
    ]
  },
  [ValueType.array]: (buf) => {
    const def = selva_proto_array_def
    const v = deserialize(def, buf)
    return [v, def.size]
  },
  [ValueType.array_end]: (buf) => {
    const def = selva_proto_control_def
    const v = deserialize(def, buf)
    return [v, def.size]
  },
  [ValueType.replication_cmd]: (_buf) => {
    throw new Error('ENOTSUP')
  },
  [ValueType.replication_sdb]: (_buf) => {
    throw new Error('ENOTSUP')
  },
}
