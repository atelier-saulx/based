import { langCodesMap } from './lang.js'
import { inspect } from 'node:util'
import {
  stringFormats,
  type Schema,
  type SchemaProp,
  type SchemaType,
  type StrictSchema,
  type StrictSchemaProp,
  type StrictSchemaType,
} from './types.js'

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
  input: SchemaType,
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
      if (!(prop.type in propDefs)) {
        errors.push(
          Error(`Invalid property type "${prop.type}": ${inspect(prop)}`),
        )
        continue
      }

      if (!valid(prop, propDefs[prop.type])) {
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
      if (validLocale(locales[k])) {
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
  | ((v: any) => boolean)
  | false
  | {
      [key: string]: Validator
    }

const valid = (val: unknown, ...options: Validator[]): boolean => {
  options: for (const option of options) {
    if (option === false) {
      return true
    }

    if (typeof option === 'function') {
      if (option(val)) {
        return true
      }
      continue
    }

    if (isObj(val) && isObj(option)) {
      for (const optionKey in option) {
        const optional = optionKey.at(-1) === '?'
        const key = optional ? optionKey.slice(0, -1) : optionKey
        if (key in val) {
          if (valid(val[key], option[optionKey])) {
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

const isFn = (v: unknown): v is Function => typeof v === 'function'
const isBool = (v: unknown): v is boolean => typeof v === 'boolean'
const isString = (v: unknown): v is string => typeof v === 'string'
const isObj = (v: unknown): v is object => v !== null && typeof v === 'object'
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
    'maxBytes?': (v) => v > 0,
    'max?': (v) => v > 0,
    'min?': (v) => v > 0,
    'format?': (v) => stringFormats.includes(v),
    'compression?': (v) => v === 'none' || v === 'deflate',
  },
  boolean: {
    ...baseProp,
    'default?': isBool,
  },
}

const validLocale = (val: unknown): boolean =>
  valid(val, isBool, {
    'required?': isBool,
    'fallback?': (v) => langCodesMap.has(v),
  })
