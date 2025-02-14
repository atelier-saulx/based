import { SchemaTypeDef } from '../../server/schema/types.js'
import { DbClient } from '../index.js'
import { MAX_ID, MAX_IDS_PER_QUERY } from './thresholds.js'
import { QueryDef } from './types.js'

export type QueryError = {
  code: number
  payload: any
}

export const ERR_TARGET_INVAL_TYPE = 1
export const ERR_TARGET_INVAL_ALIAS = 2
export const ERR_TARGET_EXCEED_MAX_IDS = 3
export const ERR_TARGET_INVAL_IDS = 4
export const ERR_TARGET_INVAL_ID = 5

const messages = {
  [ERR_TARGET_INVAL_TYPE]: (p) => `Type "${p}" does not exist`,
  [ERR_TARGET_INVAL_ALIAS]: (p) => `Invalid alias "${p}"`,
  [ERR_TARGET_EXCEED_MAX_IDS]: (p) =>
    `Exceeds max ids ${~~(p.length / 1e3)}k (max ${MAX_IDS_PER_QUERY / 1e3}k)`,
  [ERR_TARGET_INVAL_IDS]: (p) =>
    `Ids should be of type array or Uint32Array with valid ids`,
  [ERR_TARGET_INVAL_ID]: (p) =>
    `Invalid id should be a number larger then 0 "${p}"`,
}

export type ErrorCode = keyof typeof messages

export const validateType = (db: DbClient, def: QueryDef, type: string) => {
  const r = db.schemaTypesParsed[type]
  if (!r) {
    def.errors.push({
      code: ERR_TARGET_INVAL_TYPE,
      payload: type,
    })
    EMPTY_SCHEMA_DEF.locales = db.schema.locales
    return EMPTY_SCHEMA_DEF
  }
  return r
}

export const validateId = (def: QueryDef, id: any): number => {
  if (typeof id != 'number' || id == 0 || id > MAX_ID) {
    def.errors.push({
      code: ERR_TARGET_INVAL_ID,
      payload: id,
    })
    return 1
  }
  return id
}

export const validateIds = (def: QueryDef, ids: any): Uint32Array => {
  if (!Array.isArray(ids) && !(ids instanceof Uint32Array)) {
    def.errors.push({
      code: ERR_TARGET_INVAL_IDS,
      payload: ids,
    })
    return new Uint32Array([])
  }

  if (ids.length > MAX_IDS_PER_QUERY) {
    def.errors.push({
      code: ERR_TARGET_EXCEED_MAX_IDS,
      payload: ids,
    })
    return new Uint32Array([])
  }

  if (Array.isArray(ids)) {
    try {
      ids = new Uint32Array(ids)
      ids.sort()
    } catch (err) {
      def.errors.push({
        code: ERR_TARGET_INVAL_IDS,
        payload: ids,
      })
      return new Uint32Array([])
    }
  }
  // pretty heavy if it are a lot...
  for (const id of ids) {
    if (typeof id != 'number' || id == 0 || id > MAX_ID) {
      def.errors.push({
        code: ERR_TARGET_INVAL_IDS,
        payload: ids,
      })
      return new Uint32Array([])
    }
  }
  return ids
}

export const handleErrors = (def: QueryDef) => {
  if (def.errors.length) {
    let name = `Query\n`
    for (const err of def.errors) {
      name += `  ${messages[err.code](err.payload)}\n`
    }
    const err = new Error(name)
    err.stack = ''
    throw err
  }
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
