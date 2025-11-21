import native from '../native.js'
import { join } from 'node:path'
import { SchemaTypeDef } from '@based/schema/def'
import { equals, readInt32 } from '@based/utils'
import { BLOCK_HASH_SIZE, BlockHash, BlockMap, makeTreeKey, destructureTreeKey } from './blockMap.js'
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

const SELVA_ENOENT = -8

/**
 * Save a block.
 */
export function saveBlock(
  db: DbServer,
  typeId: number,
  start: number,
  end: number,
): void {
  const hash: BlockHash = new Uint8Array(BLOCK_HASH_SIZE)
  const mtKey = makeTreeKey(typeId, start)
  const file = BlockMap.blockSdbFile(typeId, start, end)
  const path = join(db.fileSystemPath, file)
  const err = native.saveBlock(path, typeId, start, db.dbCtxExternal, hash)
  if (err == SELVA_ENOENT) {
    // Generally we don't nor can't remove blocks from blockMap before we
    // attempt to access them.
    db.blockMap.removeBlock(mtKey)
  } else if (err) {
    db.emit(
      'error',
      `Save ${typeId}:${start}-${end} failed: ${native.selvaStrerror(err)}`,
    )
  } else {
    db.blockMap.updateBlock(mtKey, hash)
  }
}

type IoJobBlock = {
  filepath: string
  typeId: number
  start: number
}

async function saveBlocks(
  db: DbServer,
  blocks: IoJobBlock[],
): Promise<void> {
  // FIXME save
  //const res = await db.ioWorker.saveBlocks(blocks)
  const res = new Uint8Array(20)

  if (res.byteOffset !== 0) throw new Error('Unexpected offset')
  // if (res.byteLength / 20 !== blocks.length) throw new Error('Invalid res size')

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    const key = makeTreeKey(block.typeId, block.start)
    const err = readInt32(res, i * 20)
    const hash: BlockHash = new Uint8Array(res.buffer, i * 20 + 4, BLOCK_HASH_SIZE)

    if (err === SELVA_ENOENT) {
      // Generally we don't nor can't remove blocks from blockMap before we
      // attempt to access them.
      db.blockMap.removeBlock(key)
    } else if (err) {
      db.emit(
        'error',
        `Save ${block.typeId}:${block.start} failed: ${native.selvaStrerror(err)}`,
      )
    } else {
      db.blockMap.updateBlock(key, hash)
    }
  }
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

  if (block.loadPromise) {
    return block.loadPromise
  }

  const prevHash = block.hash
  const filename = db.blockMap.getBlockFile(block)

  // FIXME
  //const p = db.ioWorker.loadBlock(join(db.fileSystemPath, filename))
  const p = new Promise<void>(() => {})
  block.loadPromise = p
  await p
  block.loadPromise = null

  // Update and verify the hash
  const hash: BlockHash = new Uint8Array(BLOCK_HASH_SIZE)
  const end = start + def.blockCapacity - 1
  const res = native.getNodeRangeHash(
    def.id,
    start,
    end,
    hash,
    db.dbCtxExternal,
  )
  if (res) {
    const key = makeTreeKey(def.id, start)
    db.blockMap.updateBlock(key, hash)
    if (!equals(prevHash, hash)) {
      throw new Error('Block hash mismatch')
    }
  }
}

/**
 * Save a block and remove it from memory.
 */
export async function unloadBlock(
  db: DbServer,
  def: SchemaTypeDef,
  start: number,
) {
  const typeId = def.id
  const end = start + def.blockCapacity - 1
  const key = makeTreeKey(typeId, start)
  const block = db.blockMap.getBlock(key)
  if (!block) {
    throw new Error(`No such block: ${key}`)
  }

  const filepath = join(
    db.fileSystemPath,
    BlockMap.blockSdbFile(typeId, start, end),
  )
  try {
    // FIXME
    //const hash = await db.ioWorker.unloadBlock(filepath, typeId, start)
    const hash = new Uint8Array(16)
    native.delBlock(db.dbCtxExternal, typeId, start)
    db.blockMap.updateBlock(key, hash, 'fs')
  } catch (e) {
    // TODO Proper logging
    // TODO SELVA_ENOENT => db.blockMap.removeBlock(key) ??
    console.error(`Save ${typeId}:${start}-${end} failed`)
    console.error(e)
  }
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
    let err: number
    err = native.saveCommon(
      join(db.fileSystemPath, COMMON_SDB_FILE),
      db.dbCtxExternal,
    )
    if (err) {
      db.emit('error', `Save common failed: ${err}`)
      // Return ?
    }

    const blocks: {
      filepath: string
      typeId: number
      start: number
    }[] = []

    db.blockMap.foreachDirtyBlock((typeId, start, end) => {
      const file = BlockMap.blockSdbFile(typeId, start, end)
      const filepath = join(db.fileSystemPath, file)
      blocks.push({
        filepath,
        typeId,
        start,
      })
    })
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
