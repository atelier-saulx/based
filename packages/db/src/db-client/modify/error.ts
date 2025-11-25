import { DbClient } from '../../index.js'
import {
  REVERSE_TYPE_INDEX_MAP,
  type PropDef,
  type PropDefEdge,
  type SchemaPropTree,
  type SchemaTypeDef,
} from '../../schema/index.js'
import { create } from './create/index.js'
import { Ctx } from './Ctx.js'
import { del } from './delete/index.js'
import { drain } from './drain.js'
import { expire } from './expire/index.js'
import { Tmp } from './Tmp.js'
import { RANGE_ERR } from './types.js'
import { update } from './update/index.js'
import { upsert } from './upsert/index.js'

const MAGIC_KEY = Math.random().toString(36).substring(2)
const MAGIC_REG = RegExp(`("${MAGIC_KEY}|${MAGIC_KEY}")`, 'g')
const walk = (val) => {
  if (typeof val === 'object' && val !== null) {
    if (Array.isArray(val)) {
      return val.map(walk)
    }
    const obj = {}
    for (const key in val) {
      obj[MAGIC_KEY + key + MAGIC_KEY] = walk(val[key])
    }
    return obj
  }
  return val
}

const parseVal = (val) => {
  if (typeof val === 'object' && val !== null) {
    const str = JSON.stringify(walk(val)).replace(MAGIC_REG, '')
    val = str
  }
  if (typeof val === 'string' && val.length > 35) {
    return val.slice(0, 35) + `... (${val.length - 35} more characters)`
  }
  return val
}

const parseErrorArr = (
  prop: PropDef | PropDefEdge | SchemaPropTree,
  val: any,
  msg?: string,
) => {
  if ('typeIndex' in prop && 'path' in prop) {
    if (msg) {
      return `Invalid value at '${(prop.path as any).join('.')}'. Expected ${msg} received '${parseVal(val)}'`
    }
    return `Invalid value at '${(prop.path as any).join('.')}'. Expected ${REVERSE_TYPE_INDEX_MAP[prop.typeIndex as number]}, received '${parseVal(val)}'`
  }
  return `Unknown property '${val}'. Expected one of: ${Object.keys(prop).join(', ')}`
}

export const handleError = (
  db: DbClient,
  ctx: Ctx,
  fn:
    | typeof create
    | typeof update
    | typeof del
    | typeof expire
    | typeof upsert,
  args: IArguments,
  e: any,
): Promise<number> => {
  ctx.index = ctx.start
  ctx.cursor = {}

  if (e === RANGE_ERR) {
    if (ctx.start === 8) {
      throw 'Out of range. Not enough space for this payload'
    }
    drain(db, ctx)
    return fn.apply(null, args)
  }

  if (typeof e.then === 'function') {
    return e.then((id: number) => {
      if (!(e instanceof Tmp)) {
        e.id = id
      }
      return fn.apply(null, args)
    })
  }

  if (typeof e === 'string') {
    throw Error(e)
  }

  if (Array.isArray(e)) {
    const [def, val, msg] = e
    throw Error(parseErrorArr(def, val, msg))
  }

  throw e
}

export const errors = {
  NotExists: class extends Error {
    constructor(id: number, schema: SchemaTypeDef) {
      super(`Target ${schema.type}:${id} does not exist`)
    }
  },
} as const

export const errorMap = {
  1: errors.NotExists,
}
