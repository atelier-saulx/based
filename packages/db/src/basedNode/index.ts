import { readSeperateFieldFromBuffer } from './read.js'
import { SchemaTypeDef } from '../schemaTypeDef.js'
import { createObjectProp } from './createObjectProp.js'
import { BasedQueryResponse } from '../query/BasedQueryResponse.js'
import { inspect } from 'node:util'
import picocolors from 'picocolors'
import { BasedDb } from '../index.js'
import { singleRefProp } from './singleRefProp.js'
import { QueryIncludeDef } from '../query/types.js'
import { idDef } from './id.js'
import { toObjectIncludeTree, toObjectIncludeTreePrint } from './toObject.js'

export class BasedNode {
  [key: string]: any
  __q: BasedQueryResponse
  __r?: QueryIncludeDef
  __o: number
  __s: SchemaTypeDef
  constructor(schema: SchemaTypeDef, schemas: BasedDb['schemaTypesParsed']) {
    const ctx = this
    const nonEnum = {
      writable: true,
      enumerable: false,
    }
    Object.defineProperties(ctx, {
      __q: nonEnum,
      __o: nonEnum,
      __s: nonEnum,
      id: idDef,
    })
    this.__s = schema
    for (const field in schema.fields) {
      const fieldDef = schema.fields[field]
      const { path } = fieldDef
      if (path.length > 1) {
        if (!Object.getOwnPropertyDescriptor(ctx, path[0])) {
          createObjectProp(schema, ctx, path[0], schemas)
        }
      } else {
        if (fieldDef.type === 'reference') {
          singleRefProp(ctx, field, fieldDef, schemas)
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

    const msg = this.__r
      ? ' is ref need to fix includeTree'
      : toObjectIncludeTreePrint(
          '',
          this,
          this.__q.query.includeDef.includeTree,
        ).trim()

    if (nested) {
      return msg
    }

    const pre = picocolors.bold(`BasedNode[${this.__s.type}]`)
    return `${pre} ${msg}\n`
  }

  toObject() {
    // quite different if you have __r
    if (this.__r) {
      return toObjectIncludeTree({}, this, this.__r.includeTree)
    }
    return toObjectIncludeTree({}, this, this.__q.query.includeDef.includeTree)
  }

  toJSON() {
    // TODO: optimize
    return JSON.stringify(this.toObject())
  }

  toString() {
    return this.toJSON()
  }
}
