import { Schema, SchemaType, StrictSchema } from '../types.js'
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
  path: string[] = []
  lvl = 0

  parseTypes() {
    this.lvl++
    const { types } = this.schema
    expectObject(types)
    for (const type in types) {
      this.path[this.lvl] = type
      expectObject(types[type])
      if (!('props' in types[type])) {
        types[type] = { props: types[type] }
      }

      this.parseProps(types[type].props, types[type])
    }
    this.lvl--
  }

  parseProps(props, schemaType: SchemaType = null) {
    this.lvl++
    this.path[this.lvl] = 'props'
    expectObject(props)
    this.lvl++
    this.type = schemaType
    for (const key in props) {
      const prop = props[key]
      const type = getPropType(prop, props, key)
      this.path[this.lvl] = key
      if (type in propParsers) {
        propParsers[type](prop, this)
      } else {
        throw Error(INVALID_VALUE)
      }
    }
    this.lvl -= 2
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
      this.path[0] = key
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

export const parse = (schema: Schema): { schema: StrictSchema } => {
  const parser = new SchemaParser(schema)
  try {
    parser.parse()
    // @ts-ignore
    return { schema }
  } catch (e) {
    const cause = parser.path.slice(0, Math.min(4, parser.lvl) + 1)
    e.message += '\n\n' + print(schema, cause) + '\n'
    e.cause = cause
    throw e
  }
}
