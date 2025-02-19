import { PropDef, SchemaTypeDef } from '../server/schema/types.js'
import { DbClient } from './index.js'
import { ModifyState } from './modify/ModifyRes.js'
import { makeCsmtKeyFromNodeId } from './tree.js'

export class ModifyCtx {
  constructor(db: DbClient) {
    this.max = db.maxModifySize
    this.db = db
    this.buf = Buffer.allocUnsafe(db.maxModifySize)
  }
  // default values
  len: number = 0
  id = -1
  lastMain = -1
  hasSortField = -1
  queue = new Map<(payload: any) => void, ModifyState>()
  ctx: { offsets?: Record<number, number> } = {} // maybe make this different?

  payload: Buffer

  max: number
  buf: Buffer

  field: number
  prefix0: number = -1
  prefix1: number = -1

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
    data.writeUint16LE(typesSize, i)
    i += 2
    for (const [id, startId] of this.dirtyTypes) {
      const lastId = this.db.schemaTypesParsedById[id].lastId
      lastIds[id] = lastId
      data.writeUint16LE(id, i)
      i += 2
      data.writeUint32LE(startId, i)
      i += 4
      data.writeUint32LE(lastId, i)
      i += 4
    }
    for (let key of this.dirtyRanges) {
      data.writeDoubleLE(key, i)
      i += 8
    }
    data.writeUint32LE(this.len, i)
    return data
  }
}

export const flushBuffer = (db: DbClient) => {
  const ctx = db.modifyCtx
  let flushPromise: Promise<void>

  if (ctx.len) {
    const d = Date.now()
    const lastIds = {}
    const data = ctx.getData(lastIds)
    const resCtx = ctx.ctx
    const queue = ctx.queue

    flushPromise = db.hooks.flushModify(data).then(({ offsets }) => {
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
          console.warn('no offset returned, very wrong')
        }
      }

      db.writeTime += Date.now() - d
      if (queue.size) {
        flushPromise.then(() => {
          for (const [resolve, res] of queue) {
            resolve(res.getId(offsets))
          }
        })
      }
    })

    ctx.dirtyTypes.clear()
    ctx.dirtyRanges.clear()
    ctx.len = 0
    ctx.prefix0 = -1
    ctx.prefix1 = -1
    ctx.max = db.maxModifySize
    ctx.ctx = {}
  }

  db.isDraining = false

  return flushPromise
}

export const startDrain = (db: DbClient) => {
  db.isDraining = true
  process.nextTick(() => {
    flushBuffer(db)
  })
}
