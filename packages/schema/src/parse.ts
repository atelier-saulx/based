import { langCodesMap } from './lang.js'
import { inspect } from 'node:util'
import {
  dateDisplays,
  numberDisplays,
  SchemaObject,
  stringFormats,
  type Schema,
  type SchemaProp,
  type SchemaType,
  type StrictSchema,
  type StrictSchemaProp,
  type StrictSchemaType,
} from './types.js'
import { isTypedArray } from 'node:util/types'

const getProp = (input: SchemaProp): StrictSchemaProp => {
  if (typeof input === 'string') {
    return { type: input }
  }
  if (Array.isArray(input)) {
    return { type: 'enum', enum: input }
  }
  if ('ref' in input) {
    return { type: 'reference', ...input }
  }
  if ('items' in input) {
    return { type: 'references', ...input }
  }
  if ('props' in input) {
    return { type: 'object', ...input }
  }
  if ('enum' in input) {
    return { type: 'enum', ...input }
  }
  return input
}

const parseType = (
  input: SchemaType | SchemaObject,
  schema: StrictSchema,
  errors: Error[],
): StrictSchemaType => {
  const props = 'props' in input ? input.props : input
  const type: StrictSchemaType = {
    props: {},
  }
  if (isObj(props)) {
    for (const k in props) {
      const prop = getProp(props[k])
      if (prop.type === 'object') {
        type.props[k] = parseType(prop, schema, errors)
        continue
      }

      if (!(prop.type in propDefs)) {
        errors.push(
          Error(`Invalid property type "${prop.type}": ${inspect(prop)}`),
        )
        continue
      }

      if (!valid(schema, prop, propDefs[prop.type])) {
        errors.push(Error(`Invalid property "${prop.type}": ${inspect(prop)}`))
        continue
      }

      // additional checks
      if (prop.type === 'text' && !keys(schema.locales).length) {
        errors.push(
          Error('Property type "text" required "locales" to be defined'),
        )
        continue
      }

      type.props[k] = prop
    }
  } else {
    errors.push(Error('Invalid value for props: ' + inspect(input)))
  }

  return type
}

export const parse = ({
  version,
  types = {},
  locales = {},
  migrations,
  defaultTimezone,
}: Schema): { schema: StrictSchema; errors: Error[] } => {
  const errors = []
  const schema: StrictSchema = {
    locales: {},
    types: {},
  }

  // TODO validate!
  if (version) {
    schema.version = version
  }

  // TODO validate!
  if (migrations) {
    schema.migrations = migrations
  }

  // TODO validate!
  if (defaultTimezone) {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: defaultTimezone })
      schema.defaultTimezone = defaultTimezone
    } catch (e) {
      errors.push(e)
    }
  }

  if (isObj(locales)) {
    for (const k in locales) {
      if (
        valid(schema, locales[k], isBool, {
          'required?': isBool,
          'fallback?': (v) => langCodesMap.has(v),
        })
      ) {
        schema.locales[k] = locales[k]
      } else {
        errors.push(Error('Invalid value for locale: ' + inspect(locales[k])))
      }
    }
  } else {
    errors.push(Error('Invalid value for locales: ' + inspect(locales)))
  }

  if (isObj(types)) {
    for (const k in types) {
      schema.types[k] = parseType(types[k], schema, errors)
    }
  } else {
    errors.push(Error('Invalid value for types: ' + inspect(types)))
  }

  if (errors.length) {
    throw errors
  }

  return { schema, errors }
}

type Validator =
  | ((v: any, schema: StrictSchema) => boolean)
  | false
  | {
      [key: string]: Validator
    }

const valid = (
  schema: StrictSchema,
  val: unknown,
  ...options: Validator[]
): boolean => {
  options: for (const option of options) {
    if (option === false) {
      return true
    }

    if (typeof option === 'function') {
      if (option(val, schema)) {
        return true
      }
      continue
    }

    if (isObj(val) && isObj(option)) {
      for (const optionKey in option) {
        const optional = optionKey.at(-1) === '?'
        const key = optional ? optionKey.slice(0, -1) : optionKey
        if (key in val) {
          if (valid(schema, val[key], option[optionKey])) {
            continue
          }
          continue options
        }
        if (optional) {
          continue
        }
        continue options
      }

      for (const key in val) {
        if (!(key in option) && !(key + '?' in option)) {
          continue options
        }
      }

      return true
    }
  }

  return false
}

const isNumberType = (v: unknown): v is string => {
  switch (v) {
    case 'number':
    case 'int8':
    case 'uint8':
    case 'int16':
    case 'uint16':
    case 'uint32':
      return true
  }
}

const isVectorBAseType = (v: unknown): v is string =>
  isNumberType(v) || v === 'float32' || v === 'float64'

const isPositiveInt = (v: unknown): v is number =>
  isNumber(v) && v > 0 && Number.isInteger(v)
const isFn = (v: unknown): v is Function => typeof v === 'function'
const isBool = (v: unknown): v is boolean => typeof v === 'boolean'
const isNumber = (v: unknown): v is number => typeof v === 'number'
const isString = (v: unknown): v is string => typeof v === 'string'
const isObj = (v: unknown): v is object => v !== null && typeof v === 'object'
const isDate = (v: unknown) => !isNaN(new Date(v as number).getTime())
const isEnumVal = (v: unknown) => isNumber(v) || isString(v) || isBool(v)
const keys = (v: unknown) => (isObj(v) ? Object.keys(v) : [])
const baseProp = {
  type: false,
  'required?': isBool,
  'title?': isString,
  'description?': isString,
  'validation?': isFn,
  'hooks?': {
    'create?': isFn,
    'update?': isFn,
    'read?': isFn,
    'aggregate?': isFn,
    'search?': isFn,
    'groupBy?': isFn,
    'filter?': isFn,
    'include?': isFn,
  },
} as const

const propDefs: Record<string, Record<string, Validator>> = {
  text: {
    ...baseProp,
    'default?': (v) => isObj(v) && Object.values(v).every(isString),
    'format?': (v) => stringFormats.includes(v),
    'compression?': (v) => v === 'none' || v === 'deflate',
  },
  string: {
    ...baseProp,
    'default?': isString,
    'maxBytes?': isPositiveInt,
    'max?': isPositiveInt,
    'min?': isPositiveInt,
    'format?': (v) => stringFormats.includes(v),
    'compression?': (v) => v === 'none' || v === 'deflate',
  },
  boolean: {
    ...baseProp,
    'default?': isBool,
  },
  timestamp: {
    ...baseProp,
    'default?': isDate,
    'on?': (v) => v === 'create' || v === 'update',
    'display?': (v) => dateDisplays.includes(v),
    'min?': isDate,
    'max?': isDate,
    'step?': (v) => v === 'any' || isDate(v),
  },
  colvec: {
    ...baseProp,
    'default?': isTypedArray,
    size: isPositiveInt,
    'baseType?': isVectorBAseType,
  },
  reference: {
    ...baseProp,
    'default?': isPositiveInt,
    ref: isString,
    prop: isString,
    'dependent?': isBool,
  },
  number: {
    ...baseProp,
    'default?': isNumber,
    'min?': isNumber,
    'max?': isNumber,
    'step?': (v) => v === 'any' && isNumber(v),
    'display?': (v) =>
      numberDisplays.some((d) => d === v || `round-${d}` === v),
  },
  enum: {
    ...baseProp,
    enum: (v) => Array.isArray(v) && v.every(isEnumVal),
    'default?': isEnumVal,
  },
  cardinality: {
    ...baseProp,
    'maxBytes?': isPositiveInt,
    'precision?': isPositiveInt,
    'mode?': (v) => v === 'sparse' || v === 'dense',
  },
  binary: {
    ...baseProp,
    'default?': (v) => v instanceof Uint8Array,
    'maxBytes?': isPositiveInt,
    'format?': (v) => stringFormats.includes(v),
  },
  json: {
    ...baseProp,
    'default?': (v) => typeof v === 'object',
  },
}

propDefs.alias = propDefs.string
propDefs.vector = propDefs.colvec
propDefs.references = {
  ...baseProp,
  'default?': (v) => Array.isArray(v) && v.every(isPositiveInt),
  items: propDefs.reference,
}
