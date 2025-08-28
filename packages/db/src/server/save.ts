import native from '../native.js'
import { isMainThread } from 'node:worker_threads'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { VerifTree, destructureTreeKey, makeTreeKey } from './tree.js'
import {
  saveBlock,
  foreachBlock,
  foreachDirtyBlock,
  saveBlocks,
} from './blocks.js'
import { DbServer } from './index.js'
import { writeFileSync } from 'node:fs'
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
  types: { [t: number]: { lastId: number; blockCapacity: number } }
  hash: string
  commonDump: string
  rangeDumps: {
    [t: number]: RangeDump[]
  }
}

function hasPartialTypes(db: DbServer): boolean {
  for (const id in db.schemaTypesParsedById) {
    if (db.schemaTypesParsedById[id].partial) {
      return true
    }
  }
  return false
}

type SaveOpts = {
  forceFullDump?: boolean
  skipDirtyCheck?: boolean
  skipMigrationCheck?: boolean
}

function inhibitSave(
  db: DbServer,
  { skipDirtyCheck, forceFullDump, skipMigrationCheck }: SaveOpts,
): boolean {
  // RFE isMainThread needed??
  if (
    !(isMainThread && (skipDirtyCheck || db.dirtyRanges.size || forceFullDump))
  ) {
    return true
  }

  if (forceFullDump && hasPartialTypes(db)) {
    db.emit('error', 'forceFullDump is not allowed with partial types')
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

  return {
    ts,
    types,
    commonDump: COMMON_SDB_FILE,
    rangeDumps,
    hash: bufToHex(db.verifTree.hash), // TODO `hash('hex')`
  }
}

export function saveSync(db: DbServer, opts: SaveOpts = {}): void {
  if (inhibitSave(db, opts)) return

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

    if (opts.forceFullDump) {
      // reset the state just in case
      db.verifTree = new VerifTree(db.schemaTypesParsed)

      // We use db.verifTree.types instead of db.schemaTypesParsed because it's
      // ordered.
      for (const { typeId } of db.verifTree.types()) {
        const def = db.schemaTypesParsedById[typeId]
        foreachBlock(db, def, (start: number, end: number, _hash: Uint8Array) =>
          saveBlock(db, def.id, start, end),
        )
      }
    } else {
      foreachDirtyBlock(db, (_mtKey, typeId, start, end) =>
        saveBlock(db, typeId, start, end),
      )
    }

    db.dirtyRanges.clear()

    const data = makeWritelog(db, ts)
    const content = JSON.stringify(data)
    db.emit('info', `Save took ${Date.now() - ts}ms`)

    db.saveInProgress = false
    return writeFileSync(join(db.fileSystemPath, WRITELOG_FILE), content)
  } catch (err) {
    db.emit('error', `Save failed ${err.message}`)
    db.saveInProgress = false
    throw err
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

    if (opts.forceFullDump) {
      // reset the state just in case
      db.verifTree = new VerifTree(db.schemaTypesParsed)

      console.log('RESULT:', db.schemaTypesParsed, db.verifTree)

      // We use db.verifTree.types instead of db.schemaTypesParsed because it's
      // ordered.
      for (const { typeId } of db.verifTree.types()) {
        const def = db.schemaTypesParsedById[typeId]
        foreachBlock(
          db,
          def,
          (start: number, end: number, _hash: Uint8Array) => {
            const typeId = def.id
            const file = VerifTree.blockSdbFile(typeId, start, end)
            const filepath = join(db.fileSystemPath, file)
            blocks.push({
              filepath,
              typeId,
              start,
            })
          },
        )
      }
    } else {
      foreachDirtyBlock(db, (_mtKey, typeId, start, end) => {
        const file = VerifTree.blockSdbFile(typeId, start, end)
        const filepath = join(db.fileSystemPath, file)
        blocks.push({
          filepath,
          typeId,
          start,
        })
      })
    }
    db.dirtyRanges.clear()
    await saveBlocks(db, blocks)

    try {
      // Note that we assume here that verifTree didn't change before we call
      // makeWritelog(). This is true as long as db.saveInProgress protects
      // the verifTree from changes.
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
