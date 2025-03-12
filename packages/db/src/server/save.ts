import native from '../native.js'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { CsmtNodeRange, destructureCsmtKey, foreachDirtyBlock } from './tree.js'
import { DbServer } from './index.js'
import { writeFileSync } from 'node:fs'

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

export function save(db: DbServer, sync = false) {
  if (!db.dirtyRanges.size) {
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

  foreachDirtyBlock(db, (mtKey, typeId, start, end) => {
    const file = block_sdb_file(typeId, start, end)
    const path = join(db.fileSystemPath, file)
    const hash = new Uint8Array(16)
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
    } catch (err) {
      // console.error({ err })
    }
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
    dumps[typeId].push({ ...data, hash: Buffer.from(leaf.hash).toString('hex') }) // TODO .toHex() is not available in Node
  })

  const data: Writelog = {
    ts,
    types,
    commonDump: COMMON_SDB_FILE,
    rangeDumps: dumps,
  }
  const mtRoot = db.merkleTree.getRoot()
  if (mtRoot) {
    data.hash = Buffer.from(mtRoot.hash).toString('hex')
  }
  const filePath = join(db.fileSystemPath, WRITELOG_FILE)
  const content = JSON.stringify(data)
  return sync ? writeFileSync(filePath, content) : writeFile(filePath, content)
}
