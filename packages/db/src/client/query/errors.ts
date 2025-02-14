import { SchemaTypeDef } from '../../server/schema/types.js'
import { QueryDef } from './types.js'

export type QueryError = {
  code: number
  payload: any
}

export const ERR_TARGET_INVAL_TYPE = 1
export const ERR_TARGET_INVAL_ALIAS = 2
export const ERR_TARGET_EXCEED_MAX_IDS = 3

export const incorrectType = (def: QueryDef, type: string) => {
  def.errors.push({
    code: ERR_TARGET_INVAL_TYPE,
    payload: type,
  })
  return EMPTY_SCHEMA_DEF
}

export const EMPTY_SCHEMA_DEF: SchemaTypeDef = {
  type: '_error',
  cnt: 0,
  checksum: 0,
  total: 0,
  lastId: 0,
  blockCapacity: 0,
  mainLen: 0,
  buf: Buffer.from([]),
  propNames: Buffer.from([]),
  props: {},
  locales: {},
  reverseProps: {},
  id: 0,
  idUint8: new Uint8Array([0, 0]),
  main: {},
  separate: [],
  tree: {},
  hasStringProp: false,
  stringPropsSize: 0,
  stringPropsCurrent: Buffer.from([]),
  stringProps: Buffer.from([]),
  stringPropsLoop: [],
}

// import { ALIAS, PropDef, PropDefEdge } from '../../server/schema/types.js'
// import {
//   MAX_IDS_PER_QUERY,
//   MIN_ID_VALUE,
//   MAX_ID_VALUE,
//   MAX_BUFFER_SIZE,
// } from './thresholds.js'
// import { QueryByAliasObj, QueryDef } from './types.js'
// import { DbClient } from '../index.js'

// export const isValidId = (id: number): void => {
//   if (typeof id != 'number') {
//     throw new Error('Id has to be a number')
//   } else if (id < MIN_ID_VALUE || id > MAX_ID_VALUE) {
//     throw new Error(
//       `Invalid Id: The Id should range between ${MIN_ID_VALUE} and ${MAX_ID_VALUE}.)`,
//     )
//   }
// }

// export const isValidType = (
//   type: string,
//   schema: DbClient['schemaTypesParsed'],
// ): void => {
//   if (!schema[type]) {
//     throw new Error(`Incorrect type provided to query "${type}"`)
//   }
// }

// export const isValidAlias = (def: QueryDef, id: QueryByAliasObj) => {
//   for (const key in id) {
//     const prop = def.schema.props[key]
//     if (!prop || prop.typeIndex !== ALIAS) {
//       throw new Error(`Incorrect alias provided to query "${key}"`)
//     }
//   }
// }

// export const checkMaxIdsPerQuery = (
//   ids: (number | QueryByAliasObj)[],
// ): void => {
//   if (ids.length > MAX_IDS_PER_QUERY) {
//     throw new Error(`The number of IDs cannot exceed ${MAX_IDS_PER_QUERY}.`)
//   }
// }

// export const checkMaxBufferSize = (buf: Buffer): void => {
//   if (buf.byteLength > MAX_BUFFER_SIZE) {
//     throw new Error(
//       `The buffer size exceeds the maximum threshold of ${MAX_BUFFER_SIZE} bytes.` +
//         `Crrent size is ${buf.byteLength} bytes.`,
//     )
//   }
// }

// export const checkTotalBufferSize = (bufers: Buffer[]): void => {
//   let totalSize = 0
//   for (const buffer of bufers) {
//     totalSize += buffer.byteLength
//     if (totalSize > MAX_BUFFER_SIZE) {
//       throw new Error(
//         `The total buffer size exceeds the maximum threshold of ${MAX_BUFFER_SIZE} bytes.` +
//           `Crrent size is ${totalSize} bytes.`,
//       )
//     }
//   }
// }

// // ------------------------------

// export const includeDoesNotExist = (def: QueryDef, field: string) => {
//   throw new Error(`Incorrect include field provided to query "${field}")`)
// }
