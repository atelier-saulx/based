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
import { DbServer } from './index.js'
import { writeFileSync } from 'node:fs'
import { bufToHex } from '@saulx/utils'
import { COMMON_SDB_FILE, WRITELOG_FILE } from '../types.js'

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
    return '' // empty range
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
  skipMigrationCheck?: boolean,
): T extends true ? void : Promise<void>
export function save(
  db: DbServer,
  sync = false,
  forceFullDump = false,
  skipMigrationCheck = false,
): void | Promise<void> {
  if (!(isMainThread && (db.dirtyRanges.size || forceFullDump))) {
    return
  }

  if (db.migrating && !skipMigrationCheck) {
    db.emit('info', 'Block save db is migrating')
    return
  }

  if (db.saveInProgress) {
    db.emit('info', 'Already have a save in progress cancel save')
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
      console.error(`Save common failed: ${err}`)
      // Return ?
    }

    if (forceFullDump) {
      // We just rebuild the whole tree
      initCsmt(db)

      for (const key in db.schemaTypesParsed) {
        const def = db.schemaTypesParsed[key]
        foreachBlock(
          db,
          def,
          (start: number, end: number, _hash: Uint8Array) => {
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
          },
        )
      }
    } else {
      void foreachDirtyBlock(db, (mtKey, typeId, start, end) => {
        const hash = new Uint8Array(16)
        const file = saveRange(db, typeId, start, end, hash)

        if (file === null) {
          // The previous state should remain in the merkle tree for
          // load and sync purposes.
          return
        } else {
          const oldLeaf = db.merkleTree.search(mtKey)

          // If (file.length === 0) then the range is empty but that's fine,
          // we'll keep them around for now to maintain the order of the tree.
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
    db.emit('info', `Save done took ${Date.now() - ts}ms`)

    if (sync) {
      db.saveInProgress = false
      return writeFileSync(filePath, content)
    } else {
      return new Promise((resolve, reject) => {
        return writeFile(filePath, content)
          .then((v) => {
            db.saveInProgress = false
            resolve(v)
          })
          .catch((err) => {
            console.error('Save: writing writeLog failed')
            db.emit('info', `Save: writing writeLog failed ${err.message}`)
            db.saveInProgress = false
            reject(err)
          })
      })
    }
  } catch (err) {
    db.emit('info', `Save failed ${err.message}`)
    db.saveInProgress = false
    throw err
  }
}
