import native from '../native.js'
import { isMainThread } from 'node:worker_threads'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  VerifTree,
  destructureTreeKey,
  foreachBlock,
  foreachDirtyBlock,
} from './tree.js'
import { saveBlock } from './blocks.js'
import { DbServer } from './index.js'
import { writeFileSync } from 'node:fs'
import { bufToHex } from '@saulx/utils'
import { COMMON_SDB_FILE, WRITELOG_FILE } from '../types.js'

type RangeDump = {
    file: string
    hash: string
    start: number
    end: number
}

export type Writelog = {
  ts: number
  types: { [t: number]: { lastId: number; blockCapacity: number } }
  hash: string
  commonDump: string
  rangeDumps: {
    [t: number]: RangeDump[]
  }
}

function hasPartialTypes(db: DbServer): boolean {
  let res = false

  for (let id in db.schemaTypesParsedById) {
    res = res || db.schemaTypesParsedById[id].partial
  }

  return res
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

  if (forceFullDump && hasPartialTypes(db)) {
    db.emit('error', 'forceFullDump is not allowed with partial types')
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
      db.emit('error', `Save common failed: ${err}`)
      // Return ?
    }

    if (forceFullDump) {
      // reset the state just in case
      db.verifTree = new VerifTree(db.schemaTypesParsed)

      // We use db.verifTree.types instead of db.schemaTypesParsed because it's
      // ordered.
      for (const { typeId } of db.verifTree.types()) {
        const def = db.schemaTypesParsedById[typeId]
        foreachBlock(
          db,
          def,
          (start: number, end: number, _hash: Uint8Array) => saveBlock(db, def.id, start, end),
        )
      }
    } else {
      foreachDirtyBlock(db, (_mtKey, typeId, start, end) => saveBlock(db, typeId, start, end))
    }

    db.dirtyRanges.clear()

    const types: Writelog['types'] = {}
    const rangeDumps: Writelog['rangeDumps'] = {}

    for (const key in db.schemaTypesParsed) {
      const { id, lastId, blockCapacity } = db.schemaTypesParsed[key]
      types[id] = { lastId, blockCapacity }
      rangeDumps[id] = []
    }

    db.verifTree.foreachBlock((block) => {
      const [typeId, start] = destructureTreeKey(block.key)
      const def = db.schemaTypesParsedById[typeId]
      const end = start + def.blockCapacity - 1
      const data: RangeDump = {
        file: db.verifTree.getBlockFile(block),
        hash: bufToHex(block.hash),
        start,
        end,
      }

      rangeDumps[typeId].push(data)
    })

    const data: Writelog = {
      ts,
      types,
      commonDump: COMMON_SDB_FILE,
      rangeDumps,
      hash: bufToHex(db.verifTree.hash), // TODO `hash('hex')`
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
            db.emit('error', `Save: writing writeLog failed ${err.message}`)
            db.saveInProgress = false
            reject(err)
          })
      })
    }
  } catch (err) {
    db.emit('error', `Save failed ${err.message}`)
    db.saveInProgress = false
    throw err
  }
}
