import picocolors from 'picocolors'
import {
  ALIAS,
  BINARY,
  BOOLEAN,
  PropDef,
  PropDefEdge,
  REFERENCE,
  REFERENCES,
  REVERSE_TYPE_INDEX_MAP,
  SchemaTypeDef,
  STRING,
  TEXT,
  TIMESTAMP,
  VECTOR,
} from '../../server/schema/types.js'
import { propIsNumerical } from '../../server/schema/utils.js'
import { DbClient } from '../index.js'
import {
  EQUAL,
  HAS,
  isNumerical,
  LIKE,
  operatorReverseMap,
  VECTOR_FNS,
} from './filter/types.js'
import { Filter } from './query.js'
import {
  MAX_ID,
  MAX_ID_VALUE,
  MAX_IDS_PER_QUERY,
  MIN_ID_VALUE,
} from './thresholds.js'
import { QueryByAliasObj, QueryDef } from './types.js'
import { displayTarget, safeStringify } from './display.js'

export type QueryError = {
  code: number
  payload: any
}

export const ERR_TARGET_INVAL_TYPE = 1
export const ERR_TARGET_INVAL_ALIAS = 2
export const ERR_TARGET_EXCEED_MAX_IDS = 3
export const ERR_TARGET_INVAL_IDS = 4
export const ERR_TARGET_INVAL_ID = 5
export const ERR_INCLUDE_ENOENT = 6
export const ERR_FILTER_ENOENT = 7
export const ERR_FILTER_OP_FIELD = 8
export const ERR_FILTER_OP_ENOENT = 9
export const ERR_FILTER_INVALID_VAL = 10
export const ERR_FILTER_INVALID_OPTS = 11
export const ERR_FILTER_INVALID_LANG = 12
export const ERR_INCLUDE_INVALID_LANG = 13
export const ERR_SORT_ENOENT = 14
export const ERR_SORT_TYPE = 15
export const ERR_SORT_ORDER = 16
export const ERR_SORT_WRONG_TARGET = 17
export const ERR_RANGE_INVALID_OFFSET = 18
export const ERR_RANGE_INVALID_LIMIT = 19

const messages = {
  [ERR_TARGET_INVAL_TYPE]: (p) => `Type "${p}" does not exist`,
  [ERR_TARGET_INVAL_ALIAS]: (p) => {
    return `Invalid alias prodived to query\n  ${picocolors.italic(safeStringify(p, 100))}`
  },
  [ERR_TARGET_EXCEED_MAX_IDS]: (p) =>
    `Exceeds max ids ${~~(p.length / 1e3)}k (max ${MAX_IDS_PER_QUERY / 1e3}k)`,
  [ERR_TARGET_INVAL_IDS]: (p) =>
    `Ids should be of type array or Uint32Array with valid ids \n  ${picocolors.italic(safeStringify(p, 100))}`,
  [ERR_TARGET_INVAL_ID]: (p) =>
    `Invalid id should be a number larger then 0 "${p}"`,
  [ERR_INCLUDE_ENOENT]: (p) => `Include: field does not exist "${p}"`,
  [ERR_INCLUDE_INVALID_LANG]: (p) => `Include: invalid lang "${p}"`,
  [ERR_FILTER_ENOENT]: (p) => `Filter: field does not exist "${p}"`,
  [ERR_FILTER_INVALID_LANG]: (p) => `Filter: invalid lang "${p}"`,
  [ERR_FILTER_OP_ENOENT]: (p) => `Filter: invalid operator "${p}"`,
  [ERR_FILTER_OP_FIELD]: (p: Filter) =>
    `Cannot use operator "${operatorReverseMap[p[1].operation]}" on field "${p[0]}"`,
  [ERR_FILTER_INVALID_OPTS]: (p) => {
    return `Filter: Invalid opts "${safeStringify(p)}"`
  },
  [ERR_FILTER_INVALID_VAL]: (p) => {
    return `Filter: Invalid value ${p[0]} ${operatorReverseMap[p[1].operation]} "${safeStringify(p[2])}"`
  },
  [ERR_SORT_ENOENT]: (p) => `Sort: field does not exist "${p}"`,
  [ERR_SORT_WRONG_TARGET]: (p) =>
    `Sort: incorrect qeury target "${displayTarget(p)}"`,
  [ERR_SORT_ORDER]: (p) =>
    `Sort: incorrect order option "${safeStringify(p.order)}" passed to sort "${p.field}"`,
  [ERR_SORT_TYPE]: (p) =>
    `Sort: cannot sort on type "${REVERSE_TYPE_INDEX_MAP[p.typeIndex]}" on field "${p.path.join('.')}"`,
  [ERR_RANGE_INVALID_OFFSET]: (p) =>
    `Range: incorrect offset "${safeStringify(p)}"`,
  [ERR_RANGE_INVALID_LIMIT]: (p) =>
    `Range: incorrect limit "${safeStringify(p)}"`,
}

export type ErrorCode = keyof typeof messages

export const validateRange = (def: QueryDef, offset: number, limit: number) => {
  var r = false
  if (typeof offset !== 'number' || offset > MAX_ID || offset < 0) {
    def.errors.push({
      code: ERR_RANGE_INVALID_OFFSET,
      payload: offset,
    })
    r = true
  }
  if (typeof limit !== 'number' || limit > MAX_ID || limit < 1) {
    def.errors.push({
      code: ERR_RANGE_INVALID_LIMIT,
      payload: limit,
    })
    r = true
  }
  return r
}

export const isValidId = (id: number) => {
  if (typeof id != 'number') {
    return false
  } else if (id < MIN_ID_VALUE || id > MAX_ID_VALUE) {
    return false
  }
  return true
}

export const isValidString = (v: any) => {
  const isVal =
    typeof v === 'string' ||
    (v as any) instanceof Buffer ||
    ArrayBuffer.isView(v)
  return isVal
}

export const validateVal = (
  def: QueryDef,
  f: Filter,
  validate: (v: any) => boolean,
): boolean => {
  if (def.skipValidation) {
    return false
  }
  const value = f[2]
  if (Array.isArray(value)) {
    for (const v of value) {
      if (!validate(v)) {
        def.errors.push({
          code: ERR_FILTER_INVALID_VAL,
          payload: f,
        })
        return true
      }
    }
  } else if (!validate(value)) {
    def.errors.push({
      code: ERR_FILTER_INVALID_VAL,
      payload: f,
    })
    return true
  }
  return false
}

export const validateFilter = (
  def: QueryDef,
  prop: PropDef | PropDefEdge,
  f: Filter,
) => {
  if (def.skipValidation) {
    return false
  }
  const t = prop.typeIndex
  const op = f[1].operation
  if (t === REFERENCES || t === REFERENCE) {
    if (op == LIKE) {
      def.errors.push({
        code: ERR_FILTER_OP_FIELD,
        payload: f,
      })
      return true
    }
    if (t === REFERENCE && op != EQUAL) {
      def.errors.push({
        code: ERR_FILTER_OP_FIELD,
        payload: f,
      })
      return true
    }
    if (validateVal(def, f, isValidId)) {
      return true
    }
  } else if (t === VECTOR) {
    if (isNumerical(op) || op === HAS) {
      def.errors.push({
        code: ERR_FILTER_OP_FIELD,
        payload: f,
      })
      return true
    }
    if (op === LIKE) {
      const opts = f[1].opts
      if (
        (opts.fn && !VECTOR_FNS.includes(opts.fn)) ||
        (opts.score != undefined && typeof opts.score !== 'number')
      ) {
        def.errors.push({
          code: ERR_FILTER_INVALID_OPTS,
          payload: f,
        })
        return true
      }
    }
    if (
      validateVal(
        def,
        f,
        (v) => ArrayBuffer.isView(v) || v instanceof ArrayBuffer,
      )
    ) {
      return true
    }
  } else if (t === TEXT || t === STRING || t === BINARY) {
    if (isNumerical(op)) {
      def.errors.push({
        code: ERR_FILTER_OP_FIELD,
        payload: f,
      })
      return true
    }
    if (op === LIKE) {
      const opts = f[1].opts
      if (
        opts.score &&
        (typeof opts.score !== 'number' || opts.score < 0 || opts.score > 255)
      ) {
        def.errors.push({
          code: ERR_FILTER_INVALID_OPTS,
          payload: f,
        })
        return true
      }
    }
    if (validateVal(def, f, isValidString)) {
      return true
    }
  } else if (propIsNumerical(prop)) {
    if (op !== EQUAL && !isNumerical(op)) {
      def.errors.push({
        code: ERR_FILTER_OP_FIELD,
        payload: f,
      })
      return true
    }
    if (validateVal(def, f, (v) => t == TIMESTAMP || typeof v === 'number')) {
      return true
    }
  } else if (t === BOOLEAN && op !== EQUAL) {
    def.errors.push({
      code: ERR_FILTER_OP_FIELD,
      payload: f,
    })
    return true
  }

  return false
}

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

export const filterOperatorDoesNotExist = (def: QueryDef, field: string) => {
  def.errors.push({
    code: ERR_FILTER_OP_ENOENT,
    payload: field,
  })
}

export const filterInvalidLang = (def: QueryDef, field: string) => {
  def.errors.push({
    code: ERR_FILTER_INVALID_LANG,
    payload: field,
  })
}

export const filterFieldDoesNotExist = (def: QueryDef, field: string) => {
  def.errors.push({
    code: ERR_FILTER_ENOENT,
    payload: field,
  })
}

export const includeDoesNotExist = (def: QueryDef, field: string) => {
  def.errors.push({
    code: ERR_INCLUDE_ENOENT,
    payload: field,
  })
}

export const includeLangDoesNotExist = (def: QueryDef, field: string) => {
  def.errors.push({
    code: ERR_INCLUDE_INVALID_LANG,
    payload: field,
  })
}

export const validateSort = (
  def: QueryDef,
  field: string,
  orderInput?: 'asc' | 'desc',
): QueryDef['sort'] => {
  const propDef = def.props[field]

  if (orderInput && orderInput !== 'asc' && orderInput !== 'desc') {
    def.errors.push({
      code: ERR_SORT_ORDER,
      payload: { order: orderInput, field },
    })
  }
  const order = orderInput === 'asc' || orderInput === undefined ? 0 : 1

  if (!propDef) {
    def.errors.push({
      code: ERR_SORT_ENOENT,
      payload: field,
    })
    return {
      prop: EMPTY_ALIAS_PROP_DEF,
      order,
    }
  }

  const type = propDef.typeIndex

  if (type === TEXT || type === REFERENCES || type === REFERENCE) {
    def.errors.push({
      code: ERR_SORT_TYPE,
      payload: propDef,
    })
  }

  return {
    prop: def.props[field],
    order,
  }
}

export const validateAlias = (
  alias: QueryByAliasObj,
  path: string[],
  def: QueryDef,
): { def: PropDef; value: string } => {
  const schema = def.schema
  for (const k in alias) {
    if (typeof alias[k] === 'string') {
      const p = path.join('.') + k
      const prop = schema.props[p]
      if (prop.typeIndex === ALIAS) {
        return { def: prop, value: alias[k] }
      }
    } else if (typeof alias[k] === 'object') {
      const propDef = validateAlias(alias[k], [...path, k], def)
      if (propDef) {
        return propDef
      }
    }
  }
  def.errors.push({
    code: ERR_TARGET_INVAL_ALIAS,
    payload: alias,
  })
  return { value: '', def: EMPTY_ALIAS_PROP_DEF }
}

export const validateId = (def: QueryDef, id: any): number => {
  if (def.skipValidation) {
    return id
  }
  if (!isValidId(id)) {
    def.errors.push({
      code: ERR_TARGET_INVAL_ID,
      payload: id,
    })
    return 1
  }
  return id
}

export const validateIds = (def: QueryDef, ids: any): Uint32Array => {
  const origIds = ids

  if (!Array.isArray(ids) && !(ids instanceof Uint32Array)) {
    def.errors.push({
      code: ERR_TARGET_INVAL_IDS,
      payload: origIds,
    })
    return new Uint32Array([])
  }

  if (ids.length > MAX_IDS_PER_QUERY) {
    def.errors.push({
      code: ERR_TARGET_EXCEED_MAX_IDS,
      payload: origIds,
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
        payload: origIds,
      })
      return new Uint32Array([])
    }
  }

  if (def.skipValidation) {
    return ids
  }

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]
    if (typeof id !== 'number' || id == 0 || id > MAX_ID) {
      def.errors.push({
        code: ERR_TARGET_INVAL_IDS,
        payload: origIds,
      })
      return new Uint32Array([])
    }
  }
  return ids
}

export const handleErrors = (def: QueryDef) => {
  if (def.errors.length) {
    let name = `${picocolors.red('QueryError')} [${displayTarget(def)}]\n`
    for (const err of def.errors) {
      name += `  ${messages[err.code](err.payload)}\n`
    }
    const err = new Error(`Query\n`)
    err.stack = name
    throw err
  }
}

export const EMPTY_ALIAS_PROP_DEF: PropDef = {
  prop: 1,
  typeIndex: ALIAS,
  __isPropDef: true,
  separate: true,
  len: 0,
  start: 0,
  path: ['ERROR_ALIAS'],
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
