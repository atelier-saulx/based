import { Schema, SchemaProps, SchemaType, StrictSchema } from '../types.js'
import { INVALID_KEY, INVALID_VALUE, UNKNOWN_PROP } from './errors.js'
import { getPropType } from './utils.js'
import propParsers from './props.js'
import pc from 'picocolors'
import {
  expectArray,
  expectBoolean,
  expectFunction,
  expectObject,
  expectTimezoneName,
  expectVersion,
} from './assert.js'
import { deepCopy } from '@based/utils'
import {
  satisfies,
  parseRange,
  parse as parseVersion,
  Range,
  rangeIntersects,
} from '@std/semver'

export { getPropType }

export class SchemaParser {
  constructor(schema: Schema) {
    // uint8Array is not working
    this.schema = deepCopy(schema)
  }

  isItems: boolean
  inQuery: boolean
  schema: Schema
  type: SchemaType
  path: string[] = []
  lvl = 0

  parseTypes() {
    this.path[this.lvl++] = 'types'
    const { types } = this.schema
    expectObject(types)
    for (const type in types) {
      this.lvl++
      if (type === '_root') {
        throw new Error(INVALID_KEY)
      }
      this.path[this.lvl] = type
      expectObject(types[type])
      if (!('props' in types[type])) {
        types[type] = { props: types[type] } as SchemaProps
      }
      this.lvl--
    }
    for (const type in types) {
      this.path[this.lvl++] = type
      this.parseProps(types[type].props, types[type])
      this.lvl--
    }
    this.lvl--
  }

  parseProps(props: any, schemaType: SchemaType = null) {
    this.path[this.lvl++] = 'props'
    expectObject(props)
    this.type = schemaType
    for (const key in props) {
      if (key[0] === '_') {
        throw new Error(INVALID_KEY)
      }
      const prop = props[key]
      const type = getPropType(prop, props, key)
      this.path[this.lvl++] = key
      if (type in propParsers) {
        propParsers[type](prop, this)
      } else {
        throw Error(INVALID_VALUE)
      }
      this.lvl--
    }
    this.lvl--
  }

  parseLocales() {
    const { locales } = this.schema
    expectObject(locales)
    for (const locale in locales) {
      const opts = locales[locale]
      if (opts === true) {
        continue
      }
      expectObject(opts)
      for (const key in opts) {
        const val = opts[key]
        if (key === 'required') {
          expectBoolean(val)
        } else if (key === 'fallback') {
          if (Array.isArray(val) || typeof val !== 'string') {
            throw Error(INVALID_VALUE)
          }
        } else {
          throw Error(UNKNOWN_PROP)
        }
      }
    }
  }

  parseDefaultTimezone() {
    expectTimezoneName(this.schema.defaultTimezone)
  }

  parseMigrations() {
    const { migrations, version } = this.schema
    const ranges = new Map<string, Range[]>()

    expectArray(migrations)
    for (const item of migrations) {
      expectObject(item)
      expectObject(item.migrate)
      const targetRange = parseRange(item.version)
      const currentVersion = parseVersion(version)
      if (satisfies(currentVersion, targetRange)) {
        throw Error('migration version can not match current version')
      }
      if (Object.keys(item).length > 2) {
        throw new Error(
          'migrations can only have "version" and "migrate" properties',
        )
      }
      for (const type in item.migrate) {
        expectFunction(item.migrate[type])
        if (ranges.has(type)) {
          const otherRanges = ranges.get(type)
          for (const otherRange of otherRanges) {
            if (rangeIntersects(targetRange, otherRange)) {
              throw Error(
                'invalid overlapping version for migration for ' + type,
              )
            }
          }
          ranges.get(type).push(targetRange)
        } else {
          ranges.set(type, [targetRange])
        }
      }
    }
  }

  parse(): StrictSchema {
    expectObject(this.schema)
    // always do types first because it removes props shorthand
    if ('types' in this.schema) {
      this.parseTypes()
    }
    for (const key in this.schema) {
      if (key === 'version') {
        expectVersion(this.schema.version)
      } else if (key === 'props') {
        this.parseProps(this.schema.props)
      } else if (key === 'locales') {
        this.parseLocales()
      } else if (key === 'defaultTimezone') {
        this.parseDefaultTimezone()
      } else if (key === 'migrations') {
        this.parseMigrations()
      } else if (key !== 'types') {
        throw Error(UNKNOWN_PROP)
      }
    }
    return this.schema as StrictSchema
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
    return { schema: parser.parse() }
  } catch (e) {
    const cause = parser.path.slice(0, Math.min(4, parser.lvl) + 1)
    e.message += '\n\n' + print(schema, cause) + '\n'
    e.cause = cause
    throw e
  }
}
