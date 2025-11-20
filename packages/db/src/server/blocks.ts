import native from '../native.js'
import { join } from 'node:path'
import { SchemaTypeDef } from '@based/schema/def'
import { equals, readInt32 } from '@based/utils'
import { BlockMap, makeTreeKey } from './blockMap.js'
import { DbServer } from './index.js'
import { IoJobSave } from './workers/io_worker_types.js'

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
  const hash = new Uint8Array(16)
  const mtKey = makeTreeKey(typeId, start)
  const file = BlockMap.blockSdbFile(typeId, start, end)
  const path = join(db.fileSystemPath, file)
  const err = native.saveBlock(path, typeId, start, db.dbCtxExternal, hash)
  if (err == SELVA_ENOENT) {
    // Generally we don't nor can't remove blocks from verifTree before we
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

export async function saveBlocks(
  db: DbServer,
  blocks: IoJobSave['blocks'],
): Promise<void> {
  const res = await db.ioWorker.saveBlocks(blocks)

  if (res.byteOffset !== 0) throw new Error('Unexpected offset')
  // if (res.byteLength / 20 !== blocks.length) throw new Error('Invalid res size')

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    const key = makeTreeKey(block.typeId, block.start)
    const err = readInt32(res, i * 20)
    const hash = new Uint8Array(res.buffer, i * 20 + 4, 16)

    if (err === SELVA_ENOENT) {
      // Generally we don't nor can't remove blocks from verifTree before we
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

  const p = db.ioWorker.loadBlock(join(db.fileSystemPath, filename))
  block.loadPromise = p
  await p
  block.loadPromise = null

  // Update and verify the hash
  const hash = new Uint8Array(16)
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
    const hash = await db.ioWorker.unloadBlock(filepath, typeId, start)
    native.delBlock(db.dbCtxExternal, typeId, start)
    db.blockMap.updateBlock(key, hash, false)
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
  cb: (start: number, end: number, hash: Uint8Array) => void,
  includeEmptyBlocks: boolean = false,
) {
  const step = def.blockCapacity
  const lastId = db.ids[def.id - 1]

  for (let start = 1; start <= lastId; start += step) {
    const end = start + step - 1
    const hash = new Uint8Array(16)
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
