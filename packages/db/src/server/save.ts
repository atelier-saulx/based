import native from '../native.js'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { BlockMap, destructureTreeKey } from './blockMap.js'
import { saveBlocks, } from './blocks.js'
import { DbServer } from './index.js'
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
