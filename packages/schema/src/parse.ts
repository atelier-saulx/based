import { inverseLangMap, langCodesMap } from './lang.js'
import { inspect } from 'node:util'
import {
  SchemaLocales,
  stringFormats,
  type Schema,
  type SchemaProp,
  type SchemaType,
  type StrictSchema,
  type StrictSchemaProp,
  type StrictSchemaType,
} from './types.js'

const parseProp = (input: SchemaProp): StrictSchemaProp => {
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
      const prop = parseProp(props[k])
      if (prop.type === 'text') {
        if (!keys(schema.locales).length) {
          errors.push(
            Error('Property type "text" required "locales" to be defined'),
          )
          continue
        }
        if (!validText(prop)) {
          errors.push(Error('Invalid property type "text": ' + inspect(prop)))
          continue
        }
      } else if (prop.type === 'boolean') {
        if (!validBool(prop)) {
          errors.push(
            Error('Invalid property type "boolean": ' + inspect(prop)),
          )
          continue
        }
      }
      type.props[k] = prop
    }
  } else {
    errors.push(Error('Invalid value for props: ' + inspect(input)))
  }

  return type
}

// const validateProp = (prop: StrictSchemaProp, ...path: string[]) => {
//   if (prop.type === 'boolean') {
//     if ('default' in prop && typeof prop.default !== 'boolean') {
//       throw Error(`Expected boolean (${path.join('.')}.default)`)
//     }
//   } else if (prop.type === 'enum') {
//     if (
//       prop.enum.find(
//         (v) =>
//           typeof v !== 'string' &&
//           typeof v !== 'number' &&
//           typeof v !== 'boolean',
//       )
//     ) {
//     }
//     if (prop.default !== undefined && !prop.enum.includes(prop.default)) {
//       throw Error(`Unexpected value (${path.join('.')}.default)`)
//     }
//   }
// }

// export const validate = ({
//   version,
//   types,
//   locales,
//   migrations,
//   defaultTimezone,
// }: StrictSchema) => {
//   for (const type in types) {
//     for (const k in types[type].props) {
//       validateProp(types[type].props[k], type, k)
//     }
//   }

//   if (defaultTimezone) {
//     Intl.DateTimeFormat(undefined, { timeZone: defaultTimezone })
//   }
// }

export const parse = ({
  version,
  types = {},
  locales = {},
  migrations,
  defaultTimezone,
}: Schema): { schema: StrictSchema; errors: Error[] } => {
  const errors = []
  const schema: StrictSchema = {
    version,
    locales: {},
    types: {},
    migrations,
    defaultTimezone,
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
  | {
      [key: string]: Validator
    }

const valid = (val: unknown, ...options: Validator[]): boolean => {
  options: for (const option of options) {
    if (typeof option === 'function' && option(val)) {
      return true
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

const validProp = (val: unknown, option: Record<string, Validator>): boolean =>
  valid(val, {
    ...option,
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
  })

const validLocale = (val: unknown): boolean =>
  valid(val, isBool, {
    'required?': isBool,
    'fallback?': (v) => langCodesMap.has(v),
  })

const validText = (val: unknown): boolean =>
  validProp(val, {
    type: (v) => v === 'text',
    'default?': (v) => isObj(v) && Object.values(v).every(isString),
    'format?': (v) => stringFormats.includes(v),
    'compression?': (v) => v === 'none' || v === 'deflate',
  })

const validBool = (val: unknown): boolean =>
  validProp(val, {
    type: (v) => v === 'boolean',
    'default?': isBool,
  })

const isFn = (v: unknown): v is Function => typeof v === 'function'
const isBool = (v: unknown): v is boolean => typeof v === 'boolean'
const isString = (v: unknown): v is string => typeof v === 'string'
const isObj = (v: unknown): v is object => v !== null && typeof v === 'object'
const keys = (v: unknown) => (isObj(v) ? Object.keys(v) : [])
