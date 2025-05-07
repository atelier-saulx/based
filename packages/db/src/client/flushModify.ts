import { PropDef, SchemaTypeDef } from '@based/schema/def'
import { DbClient } from './index.js'
import { ModifyState } from './modify/ModifyRes.js'
import { writeUint64 } from '@saulx/utils'

// TODO This definitely shouldn't be copy-pasted here from server/tree.ts
const makeCsmtKeyFromNodeId = (
  typeId: number,
  blockCapacity: number,
  nodeId: number,
) => {
  const tmp = nodeId - +!(nodeId % blockCapacity)
  return typeId * 4294967296 + ((tmp / blockCapacity) | 0) * blockCapacity + 1
}

export class ModifyCtx {
  constructor(db: DbClient) {
    this.max = db.maxModifySize
    this.db = db
    this.buf = new Uint8Array(db.maxModifySize)
    this.reset()
  }
  // default values
  len: number = 8
  id = -1
  hasSortField = -1
  hasSortText = -1

  ctx: {
    queue?: Map<(payload: any) => void, ModifyState>
    offsets?: Record<number, number>
  } = {}

  payload: Uint8Array

  max: number
  buf: Uint8Array

  field: number
  prefix0: number = -1
  prefix1: number = -1

  lastMain = -1
  mergeMain: (PropDef | any)[] | null
  mergeMainSize: number

  db: DbClient

  dirtyRanges = new Set<number>()
  dirtyTypes = new Map<number, number>()
  markNodeDirty(schema: SchemaTypeDef, nodeId: number): void {
    const key = makeCsmtKeyFromNodeId(schema.id, schema.blockCapacity, nodeId)
    if (this.dirtyRanges.has(key)) {
      return
    }
    this.dirtyRanges.add(key)
    this.updateMax()
  }
  markTypeDirty(schema: SchemaTypeDef) {
    if (this.dirtyTypes.has(schema.id)) {
      return
    }
    this.dirtyTypes.set(schema.id, schema.lastId)
    this.updateMax()
  }
  updateMax() {
    // reserve space in the end of the buf [...data, type (16), lastId (32), typesSize (16), ...ranges (64)[], dataLen (32)]
    this.max =
      this.db.maxModifySize -
      4 -
      2 -
      this.dirtyTypes.size * 10 -
      this.dirtyRanges.size * 8
  }
  getData(lastIds: Record<number, number>) {
    const rangesSize = this.dirtyRanges.size
    const typesSize = this.dirtyTypes.size
    const data = this.buf.subarray(
      0,
      this.len + 4 + 2 + typesSize * 10 + rangesSize * 8,
    )
    let i = this.len
    data[i] = typesSize
    data[i + 1] = typesSize >>> 8
    i += 2
    for (const [id, startId] of this.dirtyTypes) {
      const lastId = this.db.schemaTypesParsedById[id].lastId
      lastIds[id] = lastId
      data[i] = id
      data[i + 1] = id >>> 8
      i += 2
      data[i++] = startId
      data[i++] = startId >>> 8
      data[i++] = startId >>> 16
      data[i++] = startId >>> 24
      data[i++] = lastId
      data[i++] = lastId >>> 8
      data[i++] = lastId >>> 16
      data[i++] = lastId >>> 24
    }
    const view = new DataView(data.buffer, data.byteOffset)
    for (let key of this.dirtyRanges) {
      view.setFloat64(i, key, true)
      i += 8
    }
    const lenMinusSchemaHash = this.len - 8
    data[i++] = lenMinusSchemaHash
    data[i++] = lenMinusSchemaHash >>> 8
    data[i++] = lenMinusSchemaHash >>> 16
    data[i++] = lenMinusSchemaHash >>> 24
    return data
  }
  reset() {
    this.dirtyTypes.clear()
    this.dirtyRanges.clear()
    writeUint64(this.buf, this.db.schema?.hash || 0, 0)
    this.len = 8
    this.prefix0 = -1
    this.prefix1 = -1
    this.lastMain = -1
    // should these also be reset in setcursor?
    this.hasSortText = -1
    this.hasSortField = -1
    this.max = this.db.maxModifySize
    this.ctx = {}
  }
}

export const flushBuffer = (db: DbClient) => {
  const ctx = db.modifyCtx
  let flushPromise: Promise<void>

  if (ctx.len) {
    const lastIds = {}
    const data = ctx.getData(lastIds)
    const resCtx = ctx.ctx

    // pass from flushModify
    flushPromise = db.hooks
      .flushModify(data)
      .then(({ offsets, dbWriteTime }) => {
        db.writeTime += dbWriteTime ?? 0
        if (offsets) {
          resCtx.offsets = offsets
          for (const typeId in lastIds) {
            if (typeId in offsets) {
              const lastId = lastIds[typeId] + offsets[typeId]
              const def = db.schemaTypesParsedById[typeId]
              const delta = lastId - def.lastId
              if (delta > 0) {
                def.lastId += delta
                def.total += delta
              }
            } else {
              console.error('Panic: No offset returned in flushModify')
            }
          }
          if (resCtx.queue?.size) {
            const queue = resCtx.queue
            resCtx.queue = null
            for (const [resolve, res] of queue) {
              resolve(res.getId())
            }
          }
        } else {
          // no offsets => schema mismatch!
          if (resCtx.queue?.size) {
            const queue = resCtx.queue
            resCtx.queue = null
            for (const [resolve] of queue) {
              // should we throw?
              resolve(null)
            }
          }
        }

        db.flushReady()
      })

    ctx.reset()
  } else {
    db.flushReady()
  }

  db.isDraining = false

  return flushPromise
}

export const startDrain = (db: DbClient) => {
  db.isDraining = true
  if (db.flushTime === 0) {
    process.nextTick(() => {
      flushBuffer(db)
    })
  } else {
    setTimeout(() => {
      flushBuffer(db)
    }, db.flushTime)
  }
}
