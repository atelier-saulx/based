import { readSeperateFieldFromBuffer } from './read.js'
import { FieldDef, SchemaTypeDef } from '../schemaTypeDef.js'
import { createObjectProp } from './createObjectProp.js'
import { BasedQueryResponse } from '../query/BasedQueryResponse.js'
import { Query } from '../query/query.js'
import { inspect } from 'node:util'
import picocolors from 'picocolors'

const toObjectIncludeTree = (obj, target: any, arr: Query['includeTree']) => {
  for (let i = 0; i < arr.length; i++) {
    const key = arr[i++] as string
    const item = arr[i] as FieldDef | Query['includeTree']
    if ('__isField' in item) {
      const v = target[key]
      obj[key] = v
    } else {
      obj[key] = toObjectIncludeTree({}, target[key], item)
    }
  }
  return obj
}

const toObjectIncludeTreePrint = (
  str: string,
  target: any,
  arr: Query['includeTree'],
  level: number = 0,
) => {
  const prefix = ''.padEnd(level * 2 + 2, ' ')
  str += '{\n'

  for (let i = 0; i < arr.length; i++) {
    const key = arr[i++] as string
    const item = arr[i] as FieldDef | Query['includeTree']
    str += prefix + `${key}: `
    if ('__isField' in item) {
      let v = target[key]
      if (item.type === 'string') {
        if (v.length > 80) {
          const chars = picocolors.italic(
            picocolors.dim(
              `${~~((Buffer.byteLength(v, 'utf8') / 1e3) * 100) / 100}kb`,
            ),
          )

          v = v.slice(0, 80) + picocolors.dim('...') + '" ' + chars
          str += `"${v}`
        } else {
          str += `"${v}"`
        }
      } else if (item.type === 'timestamp') {
        str += `${v} ${picocolors.italic(picocolors.dim(new Date(v).toString().replace(/\(.+\)/, '')))}`
      } else {
        str += v
      }
      str += '\n'
    } else {
      str += toObjectIncludeTreePrint('', target[key], item, level + 1)
    }
  }

  str += '}\n'.padStart(level * 2 + 2, ' ')
  return str
}

export class BasedNode {
  [key: string]: any
  __q: BasedQueryResponse
  __o: number
  __p?: number
  constructor(schema: SchemaTypeDef) {
    const ctx = this
    const nonEnum = {
      writable: true,
      enumerable: false,
    }
    Object.defineProperties(ctx, {
      __q: nonEnum,
      __o: nonEnum,
      __p: nonEnum,
      id: {
        set: () => undefined,
        get() {
          return this.__q.buffer.readUint32LE(this.__o)
        },
      },
    })
    for (const field in schema.fields) {
      const fieldDef = schema.fields[field]
      const { path } = fieldDef
      if (path.length > 1) {
        if (!Object.getOwnPropertyDescriptor(ctx, path[0])) {
          createObjectProp(schema, ctx, path[0])
        }
      } else {
        if (fieldDef.type === 'reference') {
          Object.defineProperty(ctx, field, {
            enumerable: true,
            set: () => undefined,
            get() {
              return 'flap REF'
              // return readSeperateFieldFromBuffer(fieldDef., ctx)
            },
          })
        } else {
          Object.defineProperty(ctx, field, {
            enumerable: true,
            set: () => undefined,
            get() {
              return readSeperateFieldFromBuffer(fieldDef, ctx)
            },
          })
        }
      }
    }
  }

  [inspect.custom](_depth, { nested }) {
    if (!this.__q) {
      const pre = picocolors.bold(`BasedNode[Detached]`)
      return `${pre}\n`
    }

    const msg = toObjectIncludeTreePrint(
      '',
      this,
      this.__q.query.includeTree,
    ).trim()

    if (nested) {
      return msg
    }

    const pre = picocolors.bold(`BasedNode[${this.__q.query.type.type}]`)
    return `${pre} ${msg}\n`
  }

  toObject(print: boolean = false) {
    return toObjectIncludeTree({}, this, this.__q.query.includeTree)
  }

  toJSON() {
    // TODO: optimize
    return JSON.stringify(this.toObject())
  }

  toString() {
    return this.toJSON()
  }
}
