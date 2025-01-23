import { ModifyCtx } from '../../index.js'
import {
  SchemaTypeDef,
  isPropDef,
  REFERENCE,
  REFERENCES,
  STRING,
  TEXT,
  ALIAS,
  BINARY,
  HLL,
} from '../../server/schema/types.js'
import { ModifyError, ModifyState } from './ModifyRes.js'
import { writeReference } from './references/reference.js'
import { writeReferences } from './references/references.js'
import { writeString } from './string.js'
import { writeText } from './text.js'
import {
  DECREMENT,
  INCREMENT,
  MERGE_MAIN,
  ModifyErr,
  ModifyOp,
  RANGE_ERR,
} from './types.js'
import { writeBinary } from './binary.js'
import { setCursor } from './setCursor.js'
import { appendFixedValue, writeFixedValue } from './fixed.js'
import { writeAlias } from './alias.js'
import { writeHll } from './hll.js'

function _modify(
  ctx: ModifyCtx,
  res: ModifyState,
  obj: Record<string, any>,
  schema: SchemaTypeDef,
  mod: ModifyOp,
  tree: SchemaTypeDef['tree'],
  overwrite: boolean,
  unsafe: boolean,
): ModifyErr {
  for (const key in obj) {
    const def = tree[key]
    if (def === undefined) {
      if (unsafe) {
        continue
      }
      return new ModifyError(tree, key)
    }

    let err: ModifyErr
    if (isPropDef(def)) {
      if (res.subProps) {
        console.log(res.subProps, def)
        // field + start shorter to check faster result
        // or make the check even faster with a buffer of all fields with all potential space
        // [0][1][2][3][4]
        // if zero just pass prop to subs
        // hardest will be references + ids (other wise can just be added)
      }

      const val = obj[key]
      const type = def.typeIndex
      if (def.separate) {
        if (type === STRING) {
          err = writeString(val, ctx, schema, def, res.tmpId, mod)
        } else if (type === TEXT) {
          err = writeText(val, ctx, schema, def, res.tmpId, mod)
        } else if (type === REFERENCE) {
          err = writeReference(val, ctx, schema, def, res, mod)
        } else if (type === REFERENCES) {
          err = writeReferences(val, ctx, schema, def, res, mod)
        } else if (type === BINARY) {
          err = writeBinary(val, ctx, schema, def, res.tmpId, mod)
        } else if (type === ALIAS) {
          err = writeAlias(val, ctx, schema, def, res.tmpId, mod)
        } else if (type === HLL) {
          err = writeHll(val, ctx, schema, def, res.tmpId, mod)
        }
      } else if (overwrite) {
        if (ctx.len + 15 + schema.mainLen > ctx.max) {
          return RANGE_ERR
        }
        setCursor(ctx, schema, def.prop, res.tmpId, mod, true)
        if (ctx.lastMain === -1) {
          let mainLenU32 = schema.mainLen
          setCursor(ctx, schema, def.prop, res.tmpId, mod)
          ctx.buf[ctx.len++] = mod
          ctx.buf[ctx.len++] = mainLenU32
          ctx.buf[ctx.len++] = mainLenU32 >>>= 8
          ctx.buf[ctx.len++] = mainLenU32 >>>= 8
          ctx.buf[ctx.len++] = mainLenU32 >>>= 8
          ctx.lastMain = ctx.len
          ctx.buf.fill(0, ctx.len, (ctx.len += schema.mainLen))
        }
        if (typeof val === 'object' && val !== null && 'increment' in val) {
          err = writeFixedValue(
            ctx,
            val.increment,
            def,
            ctx.lastMain + def.start,
          )
        } else {
          err = writeFixedValue(ctx, val, def, ctx.lastMain + def.start)
        }
      } else if (typeof val === 'object') {
        if (val !== null && 'increment' in val) {
          let increment = val.increment
          if (increment === 0) {
            continue
          }
          if (ctx.len + 10 > ctx.max) {
            return RANGE_ERR
          }
          setCursor(ctx, schema, def.prop, res.tmpId, mod)
          let start = def.start
          if (increment < 0) {
            ctx.buf[ctx.len++] = DECREMENT
            increment = -increment
          } else {
            ctx.buf[ctx.len++] = INCREMENT
          }
          ctx.buf[ctx.len++] = def.typeIndex
          ctx.buf[ctx.len++] = start
          ctx.buf[ctx.len++] = start >>>= 8
          appendFixedValue(ctx, increment, def)
        } else {
          return new ModifyError(def, val)
        }
      } else if (ctx.mergeMain) {
        ctx.mergeMain.push(def, val)
        ctx.mergeMainSize += def.len + 4
      } else {
        ctx.mergeMain = [def, val]
        ctx.mergeMainSize = def.len + 4
      }
    } else {
      err = _modify(ctx, res, obj[key], schema, mod, def, overwrite, unsafe)
    }

    if (err) {
      if (unsafe && err !== RANGE_ERR) {
        continue
      }
      return err
    }
  }
}

export function modify(
  ctx: ModifyCtx,
  res: ModifyState,
  obj: Record<string, any>,
  schema: SchemaTypeDef,
  mod: ModifyOp,
  tree: SchemaTypeDef['tree'],
  overwrite: boolean,
  unsafe: boolean = false,
): ModifyErr {
  ctx.db.markNodeDirty(schema, res.tmpId)
  return _modify(ctx, res, obj, schema, mod, tree, overwrite, unsafe)
}
