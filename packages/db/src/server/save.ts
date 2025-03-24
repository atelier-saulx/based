import native from '../native.js'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { CsmtNodeRange, destructureCsmtKey, foreachDirtyBlock } from './tree.js'
import { DbServer } from './index.js'
import { writeFileSync } from 'node:fs'
import { bufToHex } from '../utils.js'

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

export function save<T extends boolean>(db: DbServer, sync?: T): T extends true ? void : Promise<void>;
export function save(db: DbServer, sync = false): void | Promise<void> {
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
  const rangeDumps: Writelog['rangeDumps'] = {}
  for (const key in db.schemaTypesParsed) {
    const { id, lastId, blockCapacity } = db.schemaTypesParsed[key]
    types[id] = { lastId, blockCapacity }
    rangeDumps[id] = []
  }
  db.merkleTree.visitLeafNodes((leaf) => {
    const [typeId, start] = destructureCsmtKey(leaf.key)
    const data: CsmtNodeRange = leaf.data
    if (start != data.start) {
      console.error(`csmtKey start and range start mismatch: ${start} != ${data.start}`)
    }
    rangeDumps[typeId].push({ ...data, hash: bufToHex(leaf.hash) })
  })

  const data: Writelog = {
    ts,
    types,
    commonDump: COMMON_SDB_FILE,
    rangeDumps,
  }
  const mtRoot = db.merkleTree.getRoot()
  if (mtRoot) {
    data.hash = bufToHex(mtRoot.hash)
  }
  const filePath = join(db.fileSystemPath, WRITELOG_FILE)
  const content = JSON.stringify(data)
  return sync ? writeFileSync(filePath, content) : writeFile(filePath, content)
}
