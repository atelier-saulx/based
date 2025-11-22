import native from '../native.js'
import { join } from 'node:path'
import { SchemaTypeDef } from '@based/schema/def'
import { ENCODER, equals, readUint16, readUint32, writeUint16, writeUint32 } from '@based/utils'
import { BLOCK_HASH_SIZE, BlockHash, BlockMap, makeTreeKey, destructureTreeKey, Block } from './blockMap.js'
import { DbServer } from './index.js'
import { writeFile } from 'node:fs/promises'
import { bufToHex } from '@based/utils'
import { COMMON_SDB_FILE, WRITELOG_FILE } from '../types.js'

type RangeDump = {
  file: string
  hash: string
  start: number
  end: number
}

export type Writelog = {
  ts: number
  types: { [t: number]: { blockCapacity: number } }
  hash: string
  commonDump: string
  rangeDumps: {
    [t: number]: RangeDump[]
  }
}

export type SaveOpts = {
  skipDirtyCheck?: boolean
  skipMigrationCheck?: boolean
}

type IoJobBlock = {
  filepath: string
  typeId: number
  start: number
}

const SELVA_ENOENT = -8

const QOP_SAVE_BLOCK = 67
const QOP_SAVE_COMMON = 69
const MOP_LOAD = 22
const MOP_UNLOAD = 33

export function registerBlockIoListeners(db: DbServer) {
  db.addQueryListener(QOP_SAVE_BLOCK, (buf: Uint8Array) => {
    const err = readUint32(buf, 0)
    const start = readUint32(buf, 4)
    const typeId = readUint16(buf, 8)
    const hash = buf.slice(10, 10 + BLOCK_HASH_SIZE)
    const key = makeTreeKey(typeId, start)

    if (err === SELVA_ENOENT) {
      // Generally we don't nor can't remove blocks from blockMap before we
      // attempt to access them.
      db.blockMap.removeBlock(key)
    } else if (err) {
      const block = db.blockMap.updateBlock(key, hash)
      const errMsg = `Save ${typeId}:${start} failed: ${native.selvaStrerror(err)}`
      db.emit('error', errMsg)
      block.ioPromise.reject(errMsg)
    } else {
      const block = db.blockMap.updateBlock(key, hash)
      block.ioPromise?.resolve()
    }
  })

  const LOAD = 0
  const UNLOAD = 1
  db.addModifyListener(0, (buf: Uint8Array) => {
    const op = 0
    const typeId = readUint32(buf, 8)
    const start = readUint32(buf, 12)
    const err = readUint32(buf, 16)
    const hash = buf.slice(20, 20 + BLOCK_HASH_SIZE)
    const key = makeTreeKey(typeId, start)

    if (op == LOAD) {
      const block = db.blockMap.getBlock(key)
      if (err === 0) {
        const prevHash = block.hash
        if (equals(prevHash, hash)) {
          const block = db.blockMap.updateBlock(key, hash)
          block.ioPromise.resolve()
        } else {
          block.ioPromise.reject(new Error('Block hash mismatch'))
        }
      } else {
        block.ioPromise.reject(new Error(`Load ${typeId}:${start} failed: ${native.selvaStrerror(err)}`))
      }
    } else if (op == UNLOAD) {
      // TODO SELVA_ENOENT => db.blockMap.removeBlock(key) ??
      if (err === 0) {
        const block = db.blockMap.updateBlock(key, hash, 'fs')
        block.ioPromise?.resolve()
      } else {
        const block = db.blockMap.getBlock(key)
        block.ioPromise.reject(new Error(`Unload ${typeId}:${start} failed: ${native.selvaStrerror(err)}`))
      }
    }
  })
}

async function saveCommon(db: DbServer): Promise<void> {
  const filepath = ENCODER.encode(join(db.fileSystemPath, COMMON_SDB_FILE))
  const msg = new Uint8Array(filepath.byteLength + 1)
  msg.set(filepath, 6)

  return new Promise((resolve, reject) => {
    db.addQueryOnceListener(QOP_SAVE_COMMON, msg, (buf: Uint8Array) => {
      const err = readUint32(buf, 0)
      if (err) {
        const errMsg = `Save common failed: ${native.selvaStrerror(err)}`
        db.emit('error', errMsg)
        reject(new Error(errMsg))
      } else {
        resolve()
      }
    })

    native.getQueryBufThread(msg, db.dbCtxExternal)
  })
}

function setIoPromise(block: Block): Promise<void> {
    const p = block.ioPromise = Promise.withResolvers<void>()
    p.promise.then(() => block.ioPromise = null)
    return p.promise;
}

async function saveBlocks(
  db: DbServer,
  blocks: Block[],
): Promise<void> {
  await Promise.all(blocks.map((block) => {
    const [typeId, start] = destructureTreeKey(block.key)
    const def = db.schemaTypesParsedById[typeId]
    const end = start + def.blockCapacity - 1
    const filepath = ENCODER.encode(join(db.fileSystemPath, BlockMap.blockSdbFile(typeId, start, end)))
    const msg = new Uint8Array(6 + filepath.byteLength + 1)

    writeUint32(msg, start, 0)
    writeUint16(msg, typeId, 4)
    msg.set(filepath, 6)

    const p = setIoPromise(block)
    native.getQueryBufThread(msg, db.dbCtxExternal)
    return p
  }))
}

export async function loadCommon(db: DbServer, filename: string): Promise<void> {
  const filepath = ENCODER.encode(filename)
  const msg = new Uint8Array(8 + filepath.byteLength + 1)

  msg.set(filepath, 8)

  return new Promise((resolve, reject) => {
    // FIXME
    //db.addModifyOnceListener(MOP_LOAD, (buf: Uint8Array) => {
    //  const err = readUint32(buf, 0)
    //  if (err) {
    //    const errMsg = `Save common failed: ${native.selvaStrerror(err)}`
    //    db.emit('error', errMsg)
    //    reject(new Error(errMsg))
    //  } else {
    //    resolve()
    //  }
    //})

    native.modifyThread(msg, db.dbCtxExternal)
  })
}

export async function loadBlockRaw(db: DbServer, filename: string): Promise<void> {
  const filepath = ENCODER.encode(filename)
  const msg = new Uint8Array(8 + filepath.byteLength + 1)

  msg.set(filepath, 8)

  return new Promise((resolve, reject) => {
    // FIXME
    //db.addModifyOnceListener(MOP_LOAD, (buf: Uint8Array) => {
    //  const err = readUint32(buf, 0)
    //  if (err) {
    //    const errMsg = `Save common failed: ${native.selvaStrerror(err)}`
    //    db.emit('error', errMsg)
    //    reject(new Error(errMsg))
    //  } else {
    //    resolve()
    //  }
    //})

    native.modifyThread(msg, db.dbCtxExternal)
  })
}

/**
 * Load an existing block (typically of a partial type) back to memory.
 */
export async function loadBlock(
  db: DbServer,
  def: SchemaTypeDef,
  start: number,
) {
  const key = makeTreeKey(def.id, start)
  const block = db.blockMap.getBlock(key)
  if (!block) {
    throw new Error(`No such block: ${key}`)
  }

  if (block.ioPromise) {
    return block.ioPromise
  }

  const end = start + def.blockCapacity - 1
  const filepath = ENCODER.encode((join(db.fileSystemPath, BlockMap.blockSdbFile(def.id, start, end))))
  const msg = new Uint8Array(8 + filepath.byteLength + 1)

  msg.set(filepath, 8)

  const p = setIoPromise(block)
  native.modifyThread(msg, db.dbCtxExternal)
  await p
}

/**
 * Save a block and remove it from memory.
 */
export async function unloadBlock(
  db: DbServer,
  def: SchemaTypeDef,
  start: number,
) {
  const end = start + def.blockCapacity - 1
  const key = makeTreeKey(def.id, start)
  const block = db.blockMap.getBlock(key)
  if (!block) {
    throw new Error(`No such block: ${key}`)
  }

  const filepath = ENCODER.encode(join(db.fileSystemPath, BlockMap.blockSdbFile(def.id, start, end)))
  const msg = new Uint8Array(8 + filepath.byteLength + 1)

  msg.set(filepath, 8)

  const p = setIoPromise(block)
  native.modifyThread(msg, db.dbCtxExternal)
  await p
}

/**
 * Execute cb() for each block in memory.
 */
export function foreachBlock(
  db: DbServer,
  def: SchemaTypeDef,
  cb: (start: number, end: number, hash: BlockHash) => void,
  includeEmptyBlocks: boolean = false,
) {
  const step = def.blockCapacity
  const lastId = db.ids[def.id - 1]

  for (let start = 1; start <= lastId; start += step) {
    const end = start + step - 1
    const hash: BlockHash = new Uint8Array(BLOCK_HASH_SIZE)
    const res = native.getNodeRangeHash(
      def.id,
      start,
      end,
      hash,
      db.dbCtxExternal,
    )

    if (res || includeEmptyBlocks) {
      cb(start, end, hash)
    }
  }
}

function inhibitSave(
  db: DbServer,
  { skipDirtyCheck, skipMigrationCheck }: SaveOpts,
): boolean {
  if (!(skipDirtyCheck || db.blockMap.isDirty)) {
    return true
  }

  if (db.migrating && !skipMigrationCheck) {
    db.emit('info', 'Block save db is migrating')
    return true
  }

  if (db.saveInProgress) {
    db.emit('info', 'Already have a save in progress cancel save')
    return true
  }
  return false
}

function makeWritelog(db: DbServer, ts: number): Writelog {
  const types: Writelog['types'] = {}
  const rangeDumps: Writelog['rangeDumps'] = {}

  for (const key in db.schemaTypesParsed) {
    const { id, blockCapacity } = db.schemaTypesParsed[key]
    types[id] = { blockCapacity }
    rangeDumps[id] = []
  }

  db.blockMap.foreachBlock((block) => {
    const [typeId, start] = destructureTreeKey(block.key)
    const def = db.schemaTypesParsedById[typeId]
    const end = start + def.blockCapacity - 1
    const data: RangeDump = {
      file: db.blockMap.getBlockFile(block),
      hash: bufToHex(block.hash),
      start,
      end,
    }

    rangeDumps[typeId].push(data)
  })

  return {
    ts,
    types,
    commonDump: COMMON_SDB_FILE,
    rangeDumps,
    hash: bufToHex(db.blockMap.hash), // TODO `hash('hex')`
  }
}

export async function save(db: DbServer, opts: SaveOpts = {}): Promise<void> {
  if (inhibitSave(db, opts)) {
    return
  }

  let ts = Date.now()
  db.saveInProgress = true

  try {
    await saveCommon(db)

    const blocks: Block[] = []
    db.blockMap.foreachDirtyBlock((typeId, start, end, block) => blocks.push(block))
    await saveBlocks(db, blocks)

    try {
      // Note that we assume here that blockMap didn't change before we call
      // makeWritelog(). This is true as long as db.saveInProgress protects
      // the blockMap from changes.
      const data = makeWritelog(db, ts)
      await writeFile(
        join(db.fileSystemPath, WRITELOG_FILE),
        JSON.stringify(data),
      )
    } catch (err) {
      db.emit('error', `Save: writing writeLog failed ${err.message}`)
    }

    db.emit('info', `Save took ${Date.now() - ts}ms`)
  } catch (err) {
    db.emit('error', `Save failed ${err.message}`)
    throw err
  } finally {
    db.saveInProgress = false
  }
}
