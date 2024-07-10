import { readSeperateFieldFromBuffer } from './read.js'
import { SchemaTypeDef } from '../schemaTypeDef.js'
import { createObjectProp } from './createObjectProp.js'
import { BasedQueryResponse } from '../query/BasedQueryResponse.js'
import { Query } from '../query/query.js'

const toObjectAll = (obj, target: any) => {
  for (const key in target) {
    const t: any = target[key]
    if (typeof t === 'object' && t !== null) {
      obj[key] = toObjectAll({}, t)
    } else {
      obj[key] = t
    }
  }
  return obj
}

const toObjectIncludeTree = (obj, target: any, arr: Query['includeTree']) => {
  for (let i = 0; i < arr.length; i++) {
    const key = arr[i++]
    if (arr[i] === true) {
      // @ts-ignore
      obj[key] = target[key]
    } else {
      // @ts-ignore
      obj[key] = toObjectIncludeTree({}, target[key], arr[i])
    }
  }
  return obj
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

  toObject() {
    const obj = { id: this.id }
    if (this.__q.query.includeTree) {
      toObjectIncludeTree(obj, this, this.__q.query.includeTree)
    } else {
      toObjectAll(obj, this)
    }

    return obj
  }

  toJSON() {
    // TODO: optimize
    return JSON.stringify(this.toObject())
  }

  toString() {
    return this.toJSON()
  }
}
