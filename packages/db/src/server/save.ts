import native from '../native.js'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { CsmtNodeRange, destructureCsmtKey, foreachDirtyBlock } from './tree.js'
import { DbServer } from './index.js'

const WRITELOG_FILE = 'writelog.json'
const COMMON_SDB_FILE = 'common.sdb'

type Writelog = {
  ts: number
  types: { [t: number]: { lastId: number; blockCapacity: number } }
  hash?: string
  commonDump: string
  rangeDumps: {
    [t: number]: {
      // TODO add type
      file: string
      hash: string
      start: number
      end: number
    }[]
  }
}

const block_sdb_file = (typeId: number, start: number, end: number) =>
  `${typeId}_${start}_${end}.sdb`

export async function save(db: DbServer) {
  let err: number
  const ts = Date.now()

  err = native.saveCommon(
    join(db.fileSystemPath, COMMON_SDB_FILE),
    db.dbCtxExternal,
  )
  if (err) {
    console.error(`Save common failed: ${err}`)
  }

  foreachDirtyBlock(db, (mtKey, typeId, start, end) => {
    const file = block_sdb_file(typeId, start, end)
    const path = join(db.fileSystemPath, file)
    const hash = Buffer.allocUnsafe(16)
    err = native.saveRange(path, typeId, start, end, db.dbCtxExternal, hash)
    if (err) {
      console.error(`Save ${typeId}:${start}-${end} failed: ${err}`)
      return // TODO What to do with the merkle tree in db situation?
    }

    const data: CsmtNodeRange = {
      file,
      typeId,
      start,
      end,
    }
    try {
      db.merkleTree.delete(mtKey)
    } catch (err) {}
    db.merkleTree.insert(mtKey, hash, data)
  })
  db.dirtyRanges.clear()

  const types: Writelog['types'] = {}
  for (const key in db.schemaTypesParsed) {
    const def = db.schemaTypesParsed[key]
    types[def.id] = { lastId: def.lastId, blockCapacity: def.blockCapacity }
  }

  const dumps: Writelog['rangeDumps'] = {}
  for (const key in db.schemaTypesParsed) {
    const def = db.schemaTypesParsed[key]
    dumps[def.id] = []
  }
  db.merkleTree.visitLeafNodes((leaf) => {
    const [typeId] = destructureCsmtKey(leaf.key)
    const data: CsmtNodeRange = leaf.data
    dumps[typeId].push({ ...data, hash: leaf.hash.toString('hex') })
  })

  const data: Writelog = {
    ts,
    types,
    commonDump: COMMON_SDB_FILE,
    rangeDumps: dumps,
  }
  const mtRoot = db.merkleTree.getRoot()
  if (mtRoot) {
    data.hash = mtRoot.hash.toString('hex')
  }
  await writeFile(join(db.fileSystemPath, WRITELOG_FILE), JSON.stringify(data))
}
