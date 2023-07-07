import { compile } from 'data-record'

// TODO: add all the commands
export const TYPES = {
  ping: 0,
  echo: 1,
  lscmd: 2,
  'object.get': 49,
  'object.set': 53,
  modify: 68,
}
export type Command = keyof typeof TYPES
export type SelvaProtocolHeader = {
  cmd: number
  flags: number
  seqno: number
  frame_bsize: number
  msg_bsize: number
  chk: number
}

export const SELVA_NODE_ID_LEN = 16
export const SELVA_PROTO_FRAME_SIZE_MAX = 5840
export const SELVA_PROTO_MSG_SIZE_MAX = 1073741824

export const SELVA_PROTO_HDR_FREQ_RES = 0x80 /*!< req = 0; res = 1 */
export const SELVA_PROTO_HDR_FFMASK = 0x60 /*!< Mask to catch fragmentation status. */
export const SELVA_PROTO_HDR_FFIRST = 0x20 /*!< This is the first frame of a sequence. */
export const SELVA_PROTO_HDR_FLAST = 0x40 /*!< This is the last frame of the sequence. */
export const SELVA_PROTO_HDR_STREAM = 0x10
export const SELVA_PROTO_HDR_BATCH = 0x08
export const SELVA_PROTO_HDR_FDEFLATE = 0x01

export const selva_proto_header_def = compile(
  [
    { name: 'cmd', type: 'int8' },
    { name: 'flags', type: 'uint8' },
    { name: 'seqno', type: 'uint32_le' },
    { name: 'frame_bsize', type: 'uint16_le' },
    { name: 'msg_bsize', type: 'uint32_le' },
    { name: 'chk', type: 'uint32_le' },
  ],
  { align: false }
)
export const SELVA_PROTO_CHECK_OFFSET = 12

export const SELVA_PROTO_NULL = 0 /*!< A null. */
export const SELVA_PROTO_ERROR = 1 /*!< An error message. */
export const SELVA_PROTO_DOUBLE = 2 /*!< A double value. */
export const SELVA_PROTO_LONGLONG = 3 /*!< A 64-bit integer value. */
export const SELVA_PROTO_STRING = 4 /*!< A string or binary blob. */
export const SELVA_PROTO_ARRAY = 5 /*!< Begin an array. */
export const SELVA_PROTO_ARRAY_END = 6 /*!< Terminates an array of unknown length. Uses selva_proto_control. */
export const SELVA_PROTO_REPLICATION_CMD = 7 /*!< A replication message. */
export const SELVA_PROTO_REPLICATION_SDB = 8 /*!< A replication db dump message. */

export const selva_proto_null_def = compile([{ name: 'type', type: 'int8' }], {
  align: false,
})

export const selva_proto_error_def = compile(
  [
    { name: 'type', type: 'int8' },
    { name: '_spare', type: 'uint8' },
    { name: 'err_code', type: 'int16_le' },
    { name: 'bsize', type: 'uint16_le' },
  ],
  { align: false }
)

export const selva_proto_double_def = compile(
  [
    { name: 'type', type: 'int8' },
    { name: '_spare', type: 'uint8[7]' },
    { name: 'v', type: 'double_le' },
  ],
  { align: false }
)

export const selva_proto_longlong_def = compile(
  [
    { name: 'type', type: 'int8' },
    { name: 'flags', type: 'uint8' },
    { name: '_spare', type: 'uint8[6]' },
    { name: 'v', type: 'uint64_le' },
  ],
  { align: false }
)

export const SELVA_PROTO_STRING_FBINARY = 0x01 /*!< Expect binary data. */
export const SELVA_PROTO_STRING_FDEFLATE = 0x02 /*!< Compressed with deflate. */

export const selva_proto_string_def = compile(
  [
    { name: 'type', type: 'int8' },
    { name: 'flags', type: 'uint8' },
    { name: '_spare', type: 'uint8[2]' },
    { name: 'bsize', type: 'uint32_le' },
  ],
  { align: false }
)

export const SELVA_PROTO_ARRAY_FPOSTPONED_LENGTH = 0x80 /*!< Start an array of unknown length and terminate it with a special token. */
export const SELVA_PROTO_ARRAY_FLONGLONG = 0x01 /*!< A fixed size long long array follows. No encapsulation is used. */
export const SELVA_PROTO_ARRAY_FDOUBLE = 0x02 /*!< A fixed size double array follows. No encapsulation is used. */

export const selva_proto_array_def = compile(
  [
    { name: 'type', type: 'int8' },
    { name: 'flags', type: 'uint8' },
    { name: '_spare', type: 'int8[2]' },
    { name: 'length', type: 'uint32_le' },
  ],
  { align: false }
)

export const selva_proto_control_def = compile(
  [{ name: 'type', type: 'int8' }],
  { align: false }
)

export const OP_SET_TYPE = {
  char: 0,
  reference: 1,
  double: 2,
  long_long: 3,
}

export const doubleDef = compile([{ name: 'd', type: 'double_le' }])

export const longLongDef = compile([{ name: 'd', type: 'int64_le' }])

export const opSetDefCstring = compile([
  { name: 'op_set_type', type: 'int8' },
  { name: 'delete_all', type: 'int8' },
  { name: 'constraint_id', type: 'uint16_le' },
  /* 32 zeroed bytes */
  { name: '$add', type: 'cstring_p' },
  { name: '$delete', type: 'cstring_p' },
  { name: '$value', type: 'cstring_p' },
])

export const opSetDefDouble = compile([
  { name: 'op_set_type', type: 'int8' },
  { name: 'delete_all', type: 'int8' },
  /* 48 zeroed bytes */
  { name: '$add', type: 'double_le_p' },
  { name: '$delete', type: 'double_le_p' },
  { name: '$value', type: 'double_le_p' },
])

export const opSetDefInt64 = compile([
  { name: 'op_set_type', type: 'int8' },
  { name: 'delete_all', type: 'int8' },
  /* 48 zeroed bytes */
  { name: '$add', type: 'int64_le_p' },
  { name: '$delete', type: 'int64_le_p' },
  { name: '$value', type: 'int64_le_p' },
])

export const edgeMetaDef = compile([
  { name: 'op_code', type: 'int8' },
  { name: 'delete_all', type: 'int8' },
  { name: 'dst_node_id', type: 'cstring', size: SELVA_NODE_ID_LEN },
  { name: 'meta_field_name', type: 'cstring_p' },
  { name: 'meta_field_value', type: 'cstring_p' },
])

export const incrementDef = compile([
  { name: '$default', type: 'int64_le' },
  { name: '$increment', type: 'int64_le' },
])

export const incrementDoubleDef = compile([
  { name: '$default', type: 'double_le' },
  { name: '$increment', type: 'double_le' },
])
