import picocolors from 'picocolors'
import { DbClient } from '../index.js'
import {
  EQUAL,
  EXISTS,
  INCLUDES,
  isNumerical,
  LIKE,
  operatorReverseMap,
  VECTOR_FNS,
} from './filter/types.js'
import { Filter } from './query.js'
import { MAX_IDS_PER_QUERY, MIN_ID_VALUE } from './thresholds.js'
import { QueryByAliasObj, QueryDef } from './types.js'
import { displayTarget, safeStringify } from './display.js'
import {
  createEmptyDef,
  DEFAULT_MAP,
  ID_FIELD_DEF,
  isValidId,
  isValidString,
  LangCode,
  langCodesMap,
  MAX_ID,
  propIsNumerical,
  REVERSE_TYPE_INDEX_MAP,
  Validation,
  type PropDef,
  type PropDefEdge,
  type SchemaTypeDef,
} from '../../schema/index.js'
import { StepInput } from './aggregates/types.js'
import { PropType } from '../../zigTsExports.js'

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
export const ERR_INVALID_LANG = 20
export const ERR_SEARCH_ENOENT = 21
export const ERR_SEARCH_TYPE = 22
export const ERR_SEARCH_INCORRECT_VALUE = 23
export const ERR_SORT_LANG = 24

export const ERR_AGG_ENOENT = 25
export const ERR_AGG_TYPE = 26
export const ERR_AGG_INVALID_STEP_TYPE = 27
export const ERR_AGG_INVALID_STEP_RANGE = 28
export const ERR_AGG_NOT_IMPLEMENTED = 29

const messages = {
  [ERR_TARGET_INVAL_TYPE]: (p) => `Type "${p}" does not exist`,
  [ERR_TARGET_INVAL_ALIAS]: (p) => {
    return `Invalid alias provided to query\n  ${picocolors.italic(safeStringify(p, 100))}`
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
    `Sort: incorrect query target "${displayTarget(p)}"`,
  [ERR_SORT_ORDER]: (p) =>
    `Sort: incorrect order option "${safeStringify(p.order)}" passed to sort "${p.field}"`,
  [ERR_SORT_TYPE]: (p) =>
    `Sort: cannot sort on type "${REVERSE_TYPE_INDEX_MAP[p.typeIndex]}" on field "${p.path.join('.')}"`,
  [ERR_RANGE_INVALID_OFFSET]: (p) =>
    `Range: incorrect start "${safeStringify(p)}"`,
  [ERR_RANGE_INVALID_LIMIT]: (p) =>
    `Range: incorrect end "${safeStringify(p)}"`,
  [ERR_INVALID_LANG]: (p) => `Invalid locale "${p}"`,
  [ERR_SEARCH_ENOENT]: (p) => `Search: field does not exist "${p}"`,
  [ERR_SEARCH_TYPE]: (p) => `Search: incorrect type "${p.path.join('.')}"`,
  [ERR_SEARCH_INCORRECT_VALUE]: (p) =>
    `Search: incorrect query on field "${safeStringify(p)}"`,
  [ERR_SORT_LANG]: (p) => `Sort: invalid lang`,
  [ERR_AGG_ENOENT]: (p) =>
    `Field \"${p}\" in the aggregate function is invalid or unreacheable.`,
  [ERR_AGG_TYPE]: (p) => `Aggregate: incorrect type "${p.path.join('.')}"`,
  [ERR_AGG_INVALID_STEP_TYPE]: (p) => `Aggregate: Incorrect step type "${p}"`,
  [ERR_AGG_INVALID_STEP_RANGE]: (p) =>
    `Aggregate: Incorrect step range "${p}". Step ranges are limited to uint32 max value in seconds => group by ~136 years.`,
  [ERR_AGG_NOT_IMPLEMENTED]: (p) =>
    `Aggregate: Can't aggregate, feature not implemented yet. Prop: "${p}".`,
}

export type ErrorCode = keyof typeof messages

export const searchIncorrecQueryValue = (def: QueryDef, payload: any) => {
  def.errors.push({ code: ERR_SEARCH_INCORRECT_VALUE, payload })
}

export const searchIncorrectType = (
  def: QueryDef,
  payload: PropDef | PropDefEdge,
) => {
  def.errors.push({ code: ERR_SEARCH_TYPE, payload })
}

export const searchDoesNotExist = (
  def: QueryDef,
  field: string,
  isVector: boolean,
) => {
  def.errors.push({ code: ERR_SEARCH_ENOENT, payload: field })
  if (isVector) {
    return ERROR_VECTOR
  }
  return ERROR_STRING
}

export const validateRange = (def: QueryDef, offset: number, limit: number) => {
  var r = false
  if (typeof offset !== 'number' || offset > MAX_ID || offset < 0) {
    def.errors.push({ code: ERR_RANGE_INVALID_OFFSET, payload: offset })
    r = true
  }
  if (typeof limit !== 'number' || limit > MAX_ID || limit < 1) {
    def.errors.push({ code: ERR_RANGE_INVALID_LIMIT, payload: limit })
    r = true
  }
  if (limit === 0) {
    def.errors.push({ code: ERR_RANGE_INVALID_OFFSET, payload: offset })
    r = true
  }
  if (limit % 1 !== 0) {
    def.errors.push({ code: ERR_RANGE_INVALID_LIMIT, payload: limit })
    r = true
  }
  if (offset % 1 !== 0) {
    def.errors.push({ code: ERR_RANGE_INVALID_OFFSET, payload: offset })
    r = true
  }
  return r
}

export const validateVal = (
  def: QueryDef,
  f: Filter,
  validate: Validation,
): boolean => {
  if (def.skipValidation) {
    return false
  }
  const value = f[2]
  if (Array.isArray(value)) {
    for (const v of value) {
      if (validate(v, f[2].schema) !== true) {
        def.errors.push({ code: ERR_FILTER_INVALID_VAL, payload: f })
        return true
      }
    }
  } else if (validate(value, f[2].schema) !== true) {
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

  if (op == EXISTS) {
    // fields...
    if (f[2] !== undefined) {
      def.errors.push({
        code: ERR_FILTER_OP_FIELD,
        payload: f,
      })
      return true
    }
  } else if (t === PropType.references || t === PropType.reference) {
    if (op == LIKE) {
      def.errors.push({ code: ERR_FILTER_OP_FIELD, payload: f })
      return true
    }
    if (t === PropType.reference && op != EQUAL) {
      def.errors.push({
        code: ERR_FILTER_OP_FIELD,
        payload: f,
      })
      return true
    }

    // map { id: } format for filter
    const values = f[2]
    if (Array.isArray(values)) {
      let hasObject = false
      for (const v of values) {
        if (typeof v === 'object' && 'id' in v) {
          hasObject = true
          break
        }
      }
      if (hasObject) {
        f[2] = values.map((v) => {
          if (typeof v === 'object' && 'id' in v) {
            return v.id
          }
          return v
        })
      }
    } else if (typeof values === 'object' && 'id' in values) {
      f[2] = values.id
    }

    if (validateVal(def, f, prop.validation!)) {
      return true
    }
  } else if (t === PropType.vector) {
    if (isNumerical(op) || op === INCLUDES) {
      def.errors.push({ code: ERR_FILTER_OP_FIELD, payload: f })
      return true
    }
    if (op === LIKE) {
      const opts = f[1].opts
      if (
        (opts.fn && !VECTOR_FNS.includes(opts.fn)) ||
        (opts.score != undefined && typeof opts.score !== 'number')
      ) {
        def.errors.push({ code: ERR_FILTER_INVALID_OPTS, payload: f })
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
  } else if (
    t === PropType.text ||
    t === PropType.string ||
    t === PropType.binary
  ) {
    if (isNumerical(op)) {
      def.errors.push({ code: ERR_FILTER_OP_FIELD, payload: f })
      return true
    }
    if (op === LIKE) {
      const opts = f[1].opts
      if (
        opts.score &&
        (typeof opts.score !== 'number' || opts.score < 0 || opts.score > 255)
      ) {
        def.errors.push({ code: ERR_FILTER_INVALID_OPTS, payload: f })
        return true
      }
    }
    if (validateVal(def, f, isValidString)) {
      return true
    }
  } else if (propIsNumerical(prop)) {
    if (op !== EQUAL && !isNumerical(op)) {
      def.errors.push({ code: ERR_FILTER_OP_FIELD, payload: f })
      return true
    }
    if (
      validateVal(
        def,
        f,
        (v) => t == PropType.timestamp || typeof v === 'number',
      )
    ) {
      return true
    }
  } else if (t === PropType.boolean && op !== EQUAL) {
    def.errors.push({ code: ERR_FILTER_OP_FIELD, payload: f })
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
    EMPTY_SCHEMA_DEF.locales = db.schema!.locales!
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

export const validateLocale = (def: QueryDef, lang: string) => {
  const schema = def.schema
  if (!(lang in schema!.locales)) {
    def.errors.push({
      code: ERR_INVALID_LANG,
      payload: lang,
    })
  }
}

export const validateSort = (
  def: QueryDef,
  field: string,
  orderInput?: 'asc' | 'desc',
): QueryDef['sort'] => {
  let propDef = field === 'id' ? ID_FIELD_DEF : def.props![field]
  if (orderInput && orderInput !== 'asc' && orderInput !== 'desc') {
    def.errors.push({
      code: ERR_SORT_ORDER,
      payload: { order: orderInput, field },
    })
  }
  const order = orderInput === 'asc' || orderInput === undefined ? 0 : 1

  let lang: LangCode = 0
  if (!propDef) {
    let isText = false
    if (field.includes('.')) {
      const path = field.split('.')
      const x = path.slice(0, -1).join('.')
      propDef = def.props![x]
      if (propDef && propDef.typeIndex === PropType.text) {
        const k = path[path.length - 1]
        lang = langCodesMap.get(k)!
        isText = true
      }
    }
    if (!isText) {
      def.errors.push({
        code: ERR_SORT_ENOENT,
        payload: field,
      })
      return null
    }
  }
  const type = propDef.typeIndex
  if (
    type === PropType.references ||
    type === PropType.reference ||
    type === PropType.vector
  ) {
    def.errors.push({
      code: ERR_SORT_TYPE,
      payload: propDef,
    })
  } else if (type === PropType.text) {
    if (lang === 0) {
      lang = def.lang?.lang ?? 0
      if (lang === 0) {
        def.errors.push({
          code: ERR_SORT_LANG,
          payload: propDef,
        })
      }
    }
  }
  // add propDef LANG
  if ('id' in def.target || 'alias' in def.target) {
    def.errors.push({
      code: ERR_SORT_WRONG_TARGET,
      payload: def,
    })
  }

  return {
    prop: propDef.prop,
    propType: propDef.typeIndex,
    start: propDef.start ?? 0,
    len: propDef.len ?? 0,
    order,
    lang,
  }
}

export const validateAlias = (
  def: QueryDef,
  alias: QueryByAliasObj,
  path?: string,
): { def: PropDef; value: string } => {
  const schema = def.schema!
  for (const k in alias) {
    if (typeof alias[k] === 'string') {
      const p = path ? `${path}.${k}` : k
      const prop = schema.props[p]
      if (!prop) {
        // def.errors.push({ code: ERR_TARGET_INVAL_ALIAS, payload: def })
      } else if (prop.typeIndex === PropType.alias) {
        return { def: prop, value: alias[k] }
      }
    } else if (typeof alias[k] === 'object') {
      const propDef = validateAlias(def, alias[k], path ? `${path}.${k}` : k)
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
    let name = picocolors.red(`QueryError[${displayTarget(def)}]\n`)
    for (const err of def.errors) {
      try {
        name += `  ${messages[err.code](err.payload)}\n`
      } catch (e) {
        name += `  Cannot parse error:${err.code}\n`
      }
    }
    const err = new Error(`Query\n`)
    err.message = name
    err.stack = name
    throw err
  }
}

export const EMPTY_ALIAS_PROP_DEF: PropDef = {
  schema: null as any,
  prop: 1,
  typeIndex: PropType.alias,
  __isPropDef: true,
  separate: true,
  validation: () => true,
  len: 0,
  start: 0,
  default: DEFAULT_MAP[PropType.alias],
  path: ['ERROR_ALIAS'],
}

export const ERROR_STRING: PropDef = {
  schema: null as any,
  prop: 1,
  typeIndex: PropType.string,
  __isPropDef: true,
  separate: true,
  validation: () => true,
  len: 0,
  start: 0,
  default: DEFAULT_MAP[PropType.string],
  path: ['ERROR_STRING'],
}

export const ERROR_VECTOR: PropDef = {
  schema: null as any,
  prop: 1,
  typeIndex: PropType.vector,
  __isPropDef: true,
  separate: true,
  validation: () => true,
  len: 0,
  start: 0,
  default: DEFAULT_MAP[PropType.vector],
  path: ['ERROR_VECTOR'],
}

export const EMPTY_SCHEMA_DEF: SchemaTypeDef = {
  ...createEmptyDef('_error', { props: {} }, {}),
  buf: new Uint8Array([]),
  propNames: new Uint8Array([]),
  idUint8: new Uint8Array([0, 0]),
  mainEmptyAllZeroes: true,
  hasSeperateDefaults: false,
}

export const aggregationFieldDoesNotExist = (def: QueryDef, field: string) => {
  def.errors.push({
    code: ERR_AGG_ENOENT,
    payload: field,
  })
  handleErrors(def)
}
export const aggregationFieldNotNumber = (def: QueryDef, field: string) => {
  def.errors.push({
    code: ERR_AGG_TYPE,
    payload: field,
  })
  handleErrors(def)
}

export const validateStepRange = (def: QueryDef, step: StepInput) => {
  if (typeof step !== 'number' || step >= 4294967296) {
    def.errors.push({
      code: ERR_AGG_INVALID_STEP_RANGE,
      payload: step,
    })
    handleErrors(def)
  }
}

export const edgeNotImplemented = (def: QueryDef, field: string) => {
  def.errors.push({
    code: ERR_AGG_NOT_IMPLEMENTED,
    payload: field,
  })
  handleErrors(def)
}
