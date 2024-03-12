import { compile, CompiledRecordDef } from 'data-record'
import { SELVA_NODE_ID_LEN } from '../../types.js'

export enum ModifyArgType {
  SELVA_MODIFY_ARG_INVALID = '\0',
  /* Node object string field operations. */
  SELVA_MODIFY_ARG_DEFAULT_STRING = '2' /*!< Set a string value if unset. */,
  SELVA_MODIFY_ARG_STRING = '0' /*!< Value is a string. */,
  /* Node object numeric field operations. */
  SELVA_MODIFY_ARG_DEFAULT_LONGLONG = '8',
  SELVA_MODIFY_ARG_LONGLONG = '3' /*!< Value is a long long. */,
  SELVA_MODIFY_ARG_DEFAULT_DOUBLE = '9',
  SELVA_MODIFY_ARG_DOUBLE = 'A' /*!< Value is a double. */,
  SELVA_MODIFY_ARG_OP_INCREMENT = '4' /*!< Increment a long long value. */,
  SELVA_MODIFY_ARG_OP_INCREMENT_DOUBLE = 'B' /*!< Increment a double value. */,
  /* Node object set field operations. */
  SELVA_MODIFY_ARG_OP_SET = '5' /*!< Value is a struct SelvaModify_OpSet. */,
  SELVA_MODIFY_ARG_OP_ORD_SET = 'J' /*!<  Value is a struct SelvaModify_OpOrdSet. */,
  /* HLL operations. */
  SELVA_MODIFY_ARG_OP_HLL = 'I',
  /* Node object operations. */
  SELVA_MODIFY_ARG_OP_DEL = '7' /*!< Delete field; value is a modifier. */,
  SELVA_MODIFY_ARG_OP_OBJ_META = 'C' /*!< Set object user metadata. */,
  /* Edge metadata ops. */
  SELVA_MODIFY_ARG_OP_EDGE_META = 'G' /*!< Modify edge field metadata. */,
}

export enum ModifyOpSetType {
  SELVA_MODIFY_OP_SET_TYPE_CHAR = 0,
  SELVA_MODIFY_OP_SET_TYPE_REFERENCE = 1 /*!< Items are of size SELVA_NODE_ID_SIZE. */,
  SELVA_MODIFY_OP_SET_TYPE_DOUBLE = 2,
  SELVA_MODIFY_OP_SET_TYPE_LONG_LONG = 3,
}

export enum SelvaModify_OpEdgeMetaCode {
  SELVA_MODIFY_OP_EDGE_META_DEL = 0,
  SELVA_MODIFY_OP_EDGE_META_DEFAULT_STRING = 1,
  SELVA_MODIFY_OP_EDGE_META_STRING = 2,
  SELVA_MODIFY_OP_EDGE_META_DEFAULT_LONGLONG = 3,
  SELVA_MODIFY_OP_EDGE_META_LONGLONG = 4,
  SELVA_MODIFY_OP_EDGE_META_DEFAULT_DOUBLE = 5,
  SELVA_MODIFY_OP_EDGE_META_DOUBLE = 6,
}

export const SET_TYPE_TO_MODIFY_VALUE_TYPE: Record<number, (t: any) => any> = {
  0: null,
  1: null,
  2: (x) => x,
  3: (x) => BigInt(x),
} as const

export const OP_SET_TYPE = {
  char: 0,
  reference: 1,
  double: 2,
  long_long: 3,
} as const

export const ORD_SET_MODE = {
  insert: 0,
  assign: 1,
  delete: 2,
  move: 3,
} as const

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

export const opSetHll = compile([
  { name: '_spare', type: 'uint64_le' },
  { name: '$add', type: 'cstring_p' },
])

export const opOrdSetDefCstring = compile([
  { name: 'op_set_type', type: 'int8' },
  { name: 'mode', type: 'int8' },
  { name: 'constraint_id', type: 'uint16_le' },
  /* 32 zeroed bytes */
  { name: 'index', type: 'uint64_le' },
  { name: '$value', type: 'cstring_p' },
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

export const SET_OP_BY_TYPE: {
  [OP_SET_TYPE: number]: CompiledRecordDef
} = {
  0: opSetDefCstring,
  1: opSetDefCstring,
  2: opSetDefDouble,
  3: opSetDefInt64,
} as const

export const ORD_SET_OP_BY_TYPE: {
  [OP_SET_TYPE: number]: CompiledRecordDef
} = {
  1: opOrdSetDefCstring,
} as const
