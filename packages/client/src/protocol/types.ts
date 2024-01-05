import { compile } from 'data-record'

// TODO Automagicaally match with the C code?
export const selvaError = [
    "ERR_SELVA No Error",
    "ERR_SELVA EGENERAL Unknown error",
    "ERR_SELVA ENOTSUP Operation not supported",
    "ERR_SELVA EINVAL Invalid argument or input value",
    "ERR_SELVA ERANGE Result too large",
    "ERR_SELVA EINTYPE Invalid type",
    "ERR_SELVA ENAMETOOLONG Name too long",
    "ERR_SELVA ENOMEM Out of memory",
    "ERR_SELVA ENOENT Not found",
    "ERR_SELVA EEXIST Exist",
    "ERR_SELVA ENOBUFS No buffer or resource space available",
    "ERR_SELVA EINPROGRESS Operation in progress",
    "ERR_SELVA Input/output error",
    "ERR_SELVA Timed out",
    "ERR_PROTO EALREADY Operation already in progress",
    "ERR_PROTO ENOTSUP Operation not supported",
    "ERR_PROTO EINVAL Invalid argument/input value",
    "ERR_PROTO EINTYPE Invalid type",
    "ERR_PROTO ENOMEM Out of memory",
    "ERR_PROTO ENOENT Node or entity not found",
    "ERR_PROTO EEXIST Entity already exist",
    "ERR_PROTO ENOBUFS No buffer or resource space available",
    "ERR_PROTO EBADMSG Bad message",
    "ERR_PROTO EBADF Not a valid open file descriptor",
    "ERR_PROTO ECONNRESET Connection reset by peer",
    "ERR_PROTO ENOTCONN The socket is not connected",
    "ERR_PROTO EPIPE The local end has been shutdown",
    "ERR_HIERARCHY EGENERAL Unknown error",
    "ERR_HIERARCHY ENOTSUP Operation not supported",
    "ERR_HIERARCHY EINVAL Invalid argument or input value",
    "ERR_HIERARCHY ENOMEM Out of memory",
    "ERR_HIERARCHY ENOENT Not found",
    "ERR_HIERARCHY EEXIST Exist",
    "ERR_HIERARCHY ETRMAX Maximum number of recursive find calls reached",
    "ERR_SUBSCRIPTIONS EGENERAL Unknown error",
    "ERR_SUBSCRIPTIONS EINVAL Invalid argument or input value",
    "ERR_SUBSCRIPTIONS ENOMEM Out of memory",
    "ERR_SUBSCRIPTIONS ENOENT Not found",
    "ERR_SUBSCRIPTIONS EEXIST Exist",
    "ERR_RPN ECOMP Expression compilation failed",
    "ERROR_SELVA_OBJECT Maximum number of keys reached",
    "ERROR_SELVA_OBJECT Precondition mismatch or failed",
    "ERR_SELVA Invalid error code",
]

export const COMMAND_TYPES = {
  // system commands
  ping: 0,
  echo: 1,
  lscmd: 2,
  debug: 8,
  save: 15,
  load: 14,
  flush: 16,
  replicasync: 73,
  replicaof: 74,
  replicainfo: 75,
  replicawait: 77,
  rusage: 11,
  // essential
  'resolve.nodeid': 18,
  lsaliases: 72,
  publish: 78,
  subscribe: 79,
  unsubscribe: 80,
  // indexes
  'index.list': 39,
  'index.new': 40,
  'index.del': 41,
  // TODO:
  // #define CMD_ID_INDEX_DEBUG 42
  // object primitives
  'object.get': 50,
  'object.set': 54,
  'object.del': 48,
  'object.exists': 49,
  'object.len': 53,
  'object.getMeta': 57,
  'object.setMeta': 58,
  'object.incrby': 51,
  'object.incrbydouble': 52,
  'object.keys': 55,
  // modify related commands
  modify: 70,
  update: 71,
  // TODO:
  // hierarchy
  'hierarchy.types.add': 36,
  'hierarchy.types.clear': 37,
  'hierarchy.types.list': 38,
  'hierarchy.find': 19,
  'hierarchy.aggregate': 21,
  'hierarchy.edgeList': 30,
  'hierarchy.edgeGet': 31,
  'hierarchy.parents': 28,
  'hierarchy.children': 29,
  'hierarchy.addConstraint': 23,
  'hierarchy.listConstraints': 24,
  'hierarchy.del': 25,
  'hierarchy.expire': 26,
  'hierarchy.compress': 33,
  'hierarchy.listCompressed': 34,
  // subscriptions
  'subscriptions.addMarker': 59,
  'subscriptions.addAlias': 60,
  'subscriptions.list': 65,
  'subscriptions.debug': 67,
  'subscriptions.refresh': 63,
  'subscriptions.refreshMarker': 64,
  'subscriptions.del': 68,
  'subscriptions.delmarker': 69,
  // TODO:
  // #define CMD_ID_HIERARCHY_AGGREGATE 21
  // #define CMD_ID_HIERARCHY_HEADS 26
  // #define CMD_ID_HIERARCHY_TYPES_ADD 36
  // #define CMD_ID_HIERARCHY_TYPES_CLEAR 37
  // #define CMD_ID_HIERARCHY_TYPES_LIST 38
  // subscriptions
  // TODO:
  // #define CMD_ID_SUBSCRIPTIONS_ADDTRIGGER 62
  // #define CMD_ID_SUBSCRIPTIONS_DEBUG 67
  'rpn.evalBool': 44,
  'rpn.evalDouble': 45,
  'rpn.evalString': 46,
  'rpn.evalSet': 47,
}
export type Command = keyof typeof COMMAND_TYPES
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

export enum SelvaTraversal {
  SELVA_HIERARCHY_TRAVERSAL_NONE = 0x00000 /*!< Do nothing. */,
  SELVA_HIERARCHY_TRAVERSAL_NODE = 0x00001 /*!< Visit just the given node. */,
  SELVA_HIERARCHY_TRAVERSAL_ARRAY = 0x00002 /*!< Traverse an array. */,
  SELVA_HIERARCHY_TRAVERSAL_EDGE_FIELD = 0x00010 /*!< Visit nodes pointed by an edge field. */,
  SELVA_HIERARCHY_TRAVERSAL_CHILDREN = 0x00020 /*!< Visit children of the given node. */,
  SELVA_HIERARCHY_TRAVERSAL_PARENTS = 0x00040 /*!< Visit parents of the given node. */,
  SELVA_HIERARCHY_TRAVERSAL_BFS_ANCESTORS = 0x00080 /*!< Visit ancestors of the given node using BFS. */,
  SELVA_HIERARCHY_TRAVERSAL_BFS_DESCENDANTS = 0x00100 /*!< Visit descendants of the given node using BFS. */,
  SELVA_HIERARCHY_TRAVERSAL_DFS_ANCESTORS = 0x00200 /*!< Visit ancestors of the given node using DFS. */,
  SELVA_HIERARCHY_TRAVERSAL_DFS_DESCENDANTS = 0x00400 /*!< Visit descendants of the given node using DFS. */,
  SELVA_HIERARCHY_TRAVERSAL_DFS_FULL = 0x00800 /*!< Full DFS traversal of the whole hierarchy. */,
  SELVA_HIERARCHY_TRAVERSAL_BFS_EDGE_FIELD = 0x01000 /*!< Traverse an edge field according to its constraints using BFS. */,
  SELVA_HIERARCHY_TRAVERSAL_BFS_EXPRESSION = 0x02000 /*!< Traverse with an expression returning a set of field names. */,
  SELVA_HIERARCHY_TRAVERSAL_EXPRESSION = 0x04000 /*!< Visit fields with an expression returning a set of field names. */,
  SELVA_HIERARCHY_TRAVERSAL_FIELD = 0x08000 /*!< Traverse any hierarchy, edge, or object array field. */,
  SELVA_HIERARCHY_TRAVERSAL_BFS_FIELD = 0x10000 /*!< Traverse any hierarchy, edge, or object array field using BFS. */,
}

export enum SelvaMergeStrategy {
  MERGE_STRATEGY_NONE = 0 /* No merge. */,
  MERGE_STRATEGY_ALL,
  MERGE_STRATEGY_NAMED,
  MERGE_STRATEGY_DEEP,
}

export enum SelvaFindResultType {
  SELVA_FIND_QUERY_RES_IDS = 0,
  SELVA_FIND_QUERY_RES_FIELDS,
  SELVA_FIND_QUERY_RES_FIELDS_RPN,
  SELVA_FIND_QUERY_RES_INHERIT_RPN,
}

export enum SelvaResultOrder {
  /**
   * Result is not ordered by any field but can be usually expected to have a
   * deterministic order.
   */
  SELVA_RESULT_ORDER_NONE = 0,
  /**
   * Ascending order.
   */
  SELVA_RESULT_ORDER_ASC,
  /**
   * Descending order.
   */
  SELVA_RESULT_ORDER_DESC,
}

const enum_type = 'int32_le'

const selva_server_timespec = (name: string) => ({
  name,
  type: 'record',
  def: [
    { name: 'tv_sec', type: 'int64_le' },
    { name: 'tv_nsec', type: 'int64_le' },
  ],
})

export const selva_rusage = compile([
  selva_server_timespec('ru_utime'),
  selva_server_timespec('ru_stime'),
  { name: 'ru_maxrss', type: 'uint64_le' },
])

export const update_def = compile(
  [
    { name: 'dir', type: enum_type },
    { name: 'dir_opt_str', type: 'cstring_p' },
    { name: 'edge_filter_str', type: 'cstring_p' },
    { name: 'edge_filter_regs', type: 'cstring_p' },
  ],
  {
    align: true,
  }
)

export const hierarchy_find_def = compile(
  [
    { name: 'dir', type: enum_type },
    { name: 'dir_opt_str', type: 'cstring_p' },
    { name: 'edge_filter_str', type: 'cstring_p' },
    { name: 'edge_filter_regs', type: 'cstring_p' },
    { name: 'index_hints_str', type: 'cstring_p' },
    { name: 'order', type: enum_type },
    { name: 'order_by_field_str', type: 'cstring_p' },
    { name: 'skip', type: 'int64_le' },
    { name: 'offset', type: 'int64_le' },
    { name: 'limit', type: 'int64_le' },
    { name: 'merge_strategy', type: enum_type },
    { name: 'merge_str', type: 'cstring_p' },
    { name: 'res_type', type: enum_type },
    { name: 'res_opt_str', type: 'cstring_p' },
  ],
  {
    align: true,
  }
)

export const hierarchyCompressType = {
  SELVA_HIERARCHY_DETACHED_COMPRESSED_MEM: 1n,
  SELVA_HIERARCHY_DETACHED_COMPRESSED_DISK: 2n,
}

export enum SelvaHierarchy_AggregateType {
  SELVA_AGGREGATE_TYPE_COUNT_NODE = 0,
  SELVA_AGGREGATE_TYPE_COUNT_UNIQUE_FIELD,
  SELVA_AGGREGATE_TYPE_SUM_FIELD,
  SELVA_AGGREGATE_TYPE_AVG_FIELD,
  SELVA_AGGREGATE_TYPE_MIN_FIELD,
  SELVA_AGGREGATE_TYPE_MAX_FIELD,
}

export const hierarchy_agg_def = compile(
  [
    { name: 'agg_fn', type: enum_type },
    { name: 'dir', type: enum_type },
    { name: 'dir_opt_str', type: 'cstring_p' },
    { name: 'edge_filter_str', type: 'cstring_p' },
    { name: 'edge_filter_regs', type: 'cstring_p' },
    { name: 'index_hints_str', type: 'cstring_p' },
    { name: 'order', type: enum_type },
    { name: 'order_by_field_str', type: 'cstring_p' },
    { name: 'skip', type: 'int64_le' },
    { name: 'offset', type: 'int64_le' },
    { name: 'limit', type: 'int64_le' },
  ],
  {
    align: true,
  }
)

export const subscription_opts_def = compile(
  [
    { name: 'dir', type: enum_type },
    { name: 'dir_opt_str', type: 'cstring_p' },
  ],
  {
    align: true,
  }
)

export const sub_marker_pubsub_message_def = compile(
  [
    { name: 'marker_id', type: 'int64_le' },
    { name: 'flags', type: enum_type },
    { name: 'sub_ids', type: 'uint64_le_p' },
  ],
  {
    align: true,
  }
)
