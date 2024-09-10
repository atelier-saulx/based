import { Schema, SchemaAnyProp, SchemaType } from '../types.js'
import { INVALID_VALUE, UNKNOWN_PROP } from './errors.js'
import { getPropType } from './utils.js'
import propParsers from './props.js'
import pc from 'picocolors'
import { expectBoolean } from './assert.js'

export class Parser {
  constructor(schema: Schema) {
    this.schema = schema
  }

  schema: Schema
  type: SchemaType

  parseType(type: SchemaType) {
    this.parseProps(type.props, type)
  }

  parseTypes() {
    for (const type in this.schema.types) {
      this.parseType(this.schema.types[type])
    }
  }

  parseProps(props, schemaType: SchemaType = null) {
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
    for (const locale in this.schema.locales) {
      const opts = this.schema.locales[locale]
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
    if (lvl === depth) {
      const err = key in obj ? `${key}: ${JSON.stringify(v)}` : key
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
  const parser = new Parser(proxy(schema))
  try {
    parser.parse()
  } catch (e) {
    e.message += '\n\n' + print(schema, curr) + '\n'
    e.cause = curr
    throw e
  }
}

export const parseSchema = (schema: Schema) => {
  try {
    new Parser(schema).parse()
  } catch (e) {
    debug(schema)
  }
}
