import native from '../native.js'
import { join } from 'node:path'
import { SchemaTypeDef } from '@based/schema/def'
import { equals } from '@saulx/utils'
import {
  VerifTree,
  makeTreeKey,
  nodeId2BlockI,
} from './tree.js'
import { DbServer } from './index.js'

export function saveBlock(
  db: DbServer,
  typeId: number,
  start: number,
  end: number,
): void {
  const hash = new Uint8Array(16)
  const mtKey = makeTreeKey(typeId, start)
  const file = VerifTree.blockSdbFile(typeId, start, end)
  const path = join(db.fileSystemPath, file)
  const err = native.saveBlock(
    path,
    typeId,
    start,
    db.dbCtxExternal,
    hash,
  )
  if (err == -8) {
    // TODO ENOENT
    db.verifTree.remove(mtKey)
  } else if (err) {
    // TODO print the error string
    console.error(`Save ${typeId}:${start}-${end} failed: ${err}`)
  } else {
    db.verifTree.update(mtKey, hash)
  }
}

export function loadBlock(db: DbServer, def: SchemaTypeDef, start: number) {
  const key = makeTreeKey(def.id, start)
  const block = db.verifTree.getBlock(key)
  if (!block) {
    throw new Error(`No such block: ${key}`)
  }

  const prevHash = block.hash
  const filename = db.verifTree.getBlockFile(block)

  native.loadBlock(join(db.fileSystemPath, filename), db.dbCtxExternal)

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
    db.verifTree.update(key, hash)
    if (!equals(prevHash, hash)) {
      throw new Error('Block hash mismatch')
    }
  }
}

export function unloadBlock(db: DbServer, def: SchemaTypeDef, start: number) {
  const typeId = def.id
  const end = start + def.blockCapacity - 1
  const key = makeTreeKey(typeId, start)
  const block = db.verifTree.getBlock(key)
  if (!block) {
    throw new Error(`No such block: ${key}`)
  }

  const hash = new Uint8Array(16)
  const err = native.saveBlock(
    join(db.fileSystemPath, VerifTree.blockSdbFile(typeId, start, end)),
    typeId,
    start,
    db.dbCtxExternal,
    hash,
  )
  if (err == -8) {
    // TODO ENOENT
    db.verifTree.remove(key)
  } else if (err) {
    // TODO print the error string
    console.error(`Save ${typeId}:${start}-${end} failed: ${err}`)
  } else {
    native.delBlock(db.dbCtxExternal, typeId, nodeId2BlockI(start, def.blockCapacity))
    db.verifTree.update(key, hash, false)
  }
}
