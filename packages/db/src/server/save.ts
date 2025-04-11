import native from '../native.js'
import { isMainThread } from 'node:worker_threads'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  CsmtNodeRange,
  destructureCsmtKey,
  foreachBlock,
  foreachDirtyBlock,
  initCsmt,
  makeCsmtKey,
  specialBlock,
} from './tree.js'
import { DbServer, WRITELOG_FILE } from './index.js'
import { writeFileSync } from 'node:fs'
import { bufToHex } from '../utils.js'
import { createTree } from './csmt/tree.js'

const COMMON_SDB_FILE = 'common.sdb'

export type Writelog = {
  ts: number
  types: { [t: number]: { lastId: number; blockCapacity: number } }
  hash: string
  commonDump: string
  rangeDumps: {
    [t: number]: {
      file: string
      hash: string
      start: number
      end: number
    }[]
  }
}

const block_sdb_file = (typeId: number, start: number, end: number) =>
  `${typeId}_${start}_${end}.sdb`

function saveRange(
  db: DbServer,
  typeId: number,
  start: number,
  end: number,
  hashOut: Uint8Array,
): string | null {
  const file = block_sdb_file(typeId, start, end)
  const path = join(db.fileSystemPath, file)
  const err = native.saveRange(
    path,
    typeId,
    start,
    end,
    db.dbCtxExternal,
    hashOut,
  )
  if (err == -8) {
    // TODO ENOENT
    return ''
  } else if (err) {
    // TODO print the error string
    console.error(`Save ${typeId}:${start}-${end} failed: ${err}`)
    return null
  }
  return file
}

export function save<T extends boolean>(
  db: DbServer,
  sync?: T,
  forceFullDump?: boolean,
): T extends true ? void : Promise<void>
export function save(
  db: DbServer,
  sync = false,
  forceFullDump = false,
): void | Promise<void> {
  if (!(isMainThread && (db.dirtyRanges.size || forceFullDump))) {
    return
  }

  let err: number
  const ts = Date.now()

  err = native.saveCommon(
    join(db.fileSystemPath, COMMON_SDB_FILE),
    db.dbCtxExternal,
  )
  if (err) {
    console.error(`Save common failed: ${err}`)
  }

  if (forceFullDump) {
    // We just rebuild the whole tree
    initCsmt(db)

    for (const key in db.schemaTypesParsed) {
      const def = db.schemaTypesParsed[key]
      foreachBlock(db, def, (start: number, end: number, _hash: Uint8Array) => {
        const typeId = def.id
        const mtKey = makeCsmtKey(typeId, start)
        const hash = new Uint8Array(16)
        const file = saveRange(db, typeId, start, end, hash)
        if (file === null) {
          throw new Error('full dump failed')
        } else {
          const data: CsmtNodeRange = {
            file,
            typeId,
            start,
            end,
          }
          db.merkleTree.insert(mtKey, hash, data)
        }
      })
    }
  } else {
    foreachDirtyBlock(db, (mtKey, typeId, start, end) => {
      const hash = new Uint8Array(16)
      // TODO Don't save if empty
      const file = saveRange(db, typeId, start, end, hash)

      if (file === null) {
        // The previous state should remain in the merkle tree for
        // load and sync purposes.
        return
      } else if (file.length === 0) {
        // The range is empty
      } else {
        const oldLeaf = db.merkleTree.search(mtKey)

        if (oldLeaf) {
          oldLeaf.data.file = file
          db.merkleTree.update(mtKey, hash)
        } else {
          const data: CsmtNodeRange = {
            file,
            typeId,
            start,
            end,
          }
          db.merkleTree.insert(mtKey, hash, data)
        }
      }
    })
  }

  db.dirtyRanges.clear()

  const types: Writelog['types'] = {}
  const rangeDumps: Writelog['rangeDumps'] = {}
  for (const key in db.schemaTypesParsed) {
    const { id, lastId, blockCapacity } = db.schemaTypesParsed[key]
    types[id] = { lastId, blockCapacity }
    rangeDumps[id] = []
  }
  db.merkleTree.visitLeafNodes((leaf) => {
    const [typeId, start] = destructureCsmtKey(leaf.key)
    if (start == specialBlock) return // skip the type specialBlock
    const data: CsmtNodeRange = leaf.data
    if (start != data.start) {
      console.error(
        `csmtKey start and range start mismatch: ${start} != ${data.start}`,
      )
    }
    rangeDumps[typeId].push({ ...data, hash: bufToHex(leaf.hash) })
  })

  const data: Writelog = {
    ts,
    types,
    commonDump: COMMON_SDB_FILE,
    rangeDumps,
    hash: bufToHex(db.merkleTree.getRoot()?.hash ?? new Uint8Array(0)),
  }
  const filePath = join(db.fileSystemPath, WRITELOG_FILE)
  const content = JSON.stringify(data)
  return sync ? writeFileSync(filePath, content) : writeFile(filePath, content)
}
