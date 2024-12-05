import { Schema, SchemaType } from '../types.js'
import { INVALID_VALUE, UNKNOWN_PROP } from './errors.js'
import { getPropType } from './utils.js'
import propParsers from './props.js'
import pc from 'picocolors'
import { expectBoolean, expectObject } from './assert.js'

export { getPropType }

export class SchemaParser {
  constructor(schema: Schema) {
    this.schema = schema
  }

  inQuery: boolean
  schema: Schema
  type: SchemaType

  parseType(type: SchemaType) {
    expectObject(type)
    this.parseProps(type.props, type)
  }

  parseTypes() {
    const { types } = this.schema
    expectObject(types)
    for (const type in types) {
      this.parseType(types[type])
    }
  }

  parseProps(props, schemaType: SchemaType = null) {
    expectObject(props)
    this.type = schemaType
    for (const key in props) {
      const prop = props[key]
      const type = getPropType(prop)
      if (type in propParsers) {
        propParsers[type](prop, this)
      } else {
        throw Error(INVALID_VALUE)
      }
    }
  }

  parseLocales() {
    const { locales } = this.schema
    expectObject(locales)
    for (const locale in locales) {
      const opts = locales[locale]
      expectObject(opts)
      for (const key in opts) {
        const val = opts[key]
        if (key === 'required') {
          expectBoolean(val)
        } else if (key === 'fallback') {
          if (!Array.isArray(val) || !val.every((v) => typeof v === 'string')) {
            throw Error(INVALID_VALUE)
          }
        } else {
          throw Error(UNKNOWN_PROP)
        }
      }
    }
  }

  parse() {
    expectObject(this.schema)
    for (const key in this.schema) {
      if (key === 'types') {
        this.parseTypes()
      } else if (key === 'props') {
        this.parseProps(this.schema.props)
      } else if (key === 'locales') {
        this.parseLocales()
      } else {
        throw Error(UNKNOWN_PROP)
      }
    }
  }
}

export const print = (schema: Schema, path: string[]) => {
  let obj = schema
  const depth = path.length - 1
  const lines: string[] = path.map((key, lvl) => {
    const v = obj[key]
    const padding = '  '.repeat(lvl)
    const prefix = key === Object.keys(obj)[0] ? '' : `${padding}...\n`
    if (lvl === depth && lvl !== 0) {
      const err =
        key in obj
          ? `${key}: ${typeof v === 'object' && v !== null && !Array.isArray(v) ? `{..}` : JSON.stringify(v)}`
          : key
      return `${prefix}${'--'.repeat(lvl - 1)}> ${pc.red(err)}`
    }
    obj = v
    return `${prefix}${padding}${key}: {`
  })
  return lines.join('\n')
}

export const debug = (schema: Schema) => {
  let curr
  const proxy = (obj, path = []) => {
    const copy = {}
    return new Proxy(obj, {
      get(_, key) {
        const v = obj[key]
        curr = [...path, key]
        if (typeof v !== 'object' || v === null) {
          return v
        }
        copy[key] ??= proxy(obj[key], curr)
        return copy[key]
      },
    })
  }
  const parser = new SchemaParser(proxy(schema))
  try {
    parser.parse()
  } catch (e) {
    e.message += '\n\n' + print(schema, curr) + '\n'
    e.cause = curr
    throw e
  }
}

export const parse = (schema: Schema): { schema: Schema } => {
  try {
    new SchemaParser(schema).parse()
    return { schema }
  } catch (e) {
    debug(schema)
  }
}
