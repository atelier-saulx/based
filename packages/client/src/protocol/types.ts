import { compile } from 'data-record'

export const TYPES = {
  // system commands
  ping: 0,
  echo: 1,
  lscmd: 2,
  debug: 8,
  save: 15,
  load: 14,
  flush: 16,
  replicasync: 71,
  replicaof: 72,
  replicainfo: 73,
  replicawait: 75,
  // essential
  'resolve.nodeid': 18,
  lsaliases: 70,
  publish: 76,
  subscribe: 77,
  unsubscribe: 78,
  // indexes
  'index.list': 38,
  // TODO:
  // #define CMD_ID_INDEX_NEW 39
  // #define CMD_ID_INDEX_DEL 40
  // #define CMD_ID_INDEX_DEBUG 41
  // object primitives
  'object.get': 49,
  'object.set': 53,
  'object.del': 47,
  'object.exists': 48,
  'object.len': 52,
  'object.setMeta': 57,
  'object.incrby': 50,
  'object.incrbydouble': 51,
  // TODO:
  // #define CMD_ID_OBJECT_KEYS 54 // TODO: needs an optional argument
  // modify related commands
  modify: 68,
  // TODO:
  // #define CMD_ID_UPDATE 69
  // hierarchy
  'hierarchy.find': 19,
  'hierarchy.edgeList': 29,
  'hierarchy.parents': 27,
  'hierarchy.children': 28,
  // TODO:
  // #define CMD_ID_HIERARCHY_FIND 19
  // #define CMD_ID_HIERARCHY_INHERIT 20
  // #define CMD_ID_HIERARCHY_AGGREGATE 21
  // #define CMD_ID_HIERARCHY_ADDCONSTRAINT 23
  // #define CMD_ID_HIERARCHY_DEL 25
  // #define CMD_ID_HIERARCHY_HEADS 26
  // #define CMD_ID_HIERARCHY_TYPES_ADD 35
  // #define CMD_ID_HIERARCHY_TYPES_CLEAR 36
  // #define CMD_ID_HIERARCHY_TYPES_LIST 37
  // subscriptions
  // TODO:
  // #define CMD_ID_SUBSCRIPTIONS_ADD 58
  // #define CMD_ID_SUBSCRIPTIONS_ADDALIAS 59
  // #define CMD_ID_SUBSCRIPTIONS_ADDTRIGGER 61
  // #define CMD_ID_SUBSCRIPTIONS_ADDTRIGGER 61
  // #define CMD_ID_SUBSCRIPTIONS_REFRESH 62
  // #define CMD_ID_SUBSCRIPTIONS_LIST 63
  // #define CMD_ID_SUBSCRIPTIONS_LISTMISSING 64
  // #define CMD_ID_SUBSCRIPTIONS_DEBUG 65
  // #define CMD_ID_SUBSCRIPTIONS_DEL 66
  // #define CMD_ID_SUBSCRIPTIONS_DELMARKER 67
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
