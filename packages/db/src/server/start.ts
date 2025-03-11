import { stringHash } from '@saulx/hash'
import { DbServer, DbWorker } from './index.js'
import native from '../native.js'
import { rm, mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createTree } from './csmt/index.js'
import { foreachBlock } from './tree.js'
import { availableParallelism } from 'node:os'
import exitHook from 'exit-hook'
import './worker.js'
import { save } from './save.js'
import { DEFAULT_BLOCK_CAPACITY } from '@based/schema/def'

const SCHEMA_FILE = 'schema.json'
const WRITELOG_FILE = 'writelog.json'

const makeCsmtKey = (typeId: number, start: number) =>
  typeId * 4294967296 + start

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

type CsmtNodeRange = {
  file: string
  typeId: number
  start: number
  end: number
}

export async function start(db: DbServer, opts: { clean?: boolean, hosted?: boolean }) {
  const path = db.fileSystemPath
  const id = stringHash(path) >>> 0
  const noop = () => {}

  if (opts?.clean) {
    await rm(path, { recursive: true, force: true }).catch(noop)
  }

  await mkdir(path, { recursive: true }).catch(noop)

  // not doing db yet
  // db.modifyBuf = new SharedArrayBuffer(db.maxModifySize)
  db.dbCtxExternal = native.start(id)

  let writelog: Writelog = null
  try {
    writelog = JSON.parse(
      (await readFile(join(path, WRITELOG_FILE))).toString(),
    )

    // Load the common dump
    native.loadCommon(join(path, writelog.commonDump), db.dbCtxExternal)

    // Load all range dumps
    for (const typeId in writelog.rangeDumps) {
      const dumps = writelog.rangeDumps[typeId]
      for (const dump of dumps) {
        const fname = dump.file
        const err = native.loadRange(join(path, fname), db.dbCtxExternal)
        if (err) {
          console.log(`Failed to load a range. file: "${fname}": ${err}`)
        }
      }
    }

    const schema = await readFile(join(path, SCHEMA_FILE))
    if (schema) {
      // Prop need to not call setting in selva
      db.putSchema(JSON.parse(schema.toString()), true)
    }
  } catch (err) {}

  // The merkle tree should be empty at start.
  if (!db.merkleTree || db.merkleTree.getRoot()) {
    db.merkleTree = createTree(db.createCsmtHashFun)
  }


  // FDN-791 CSMT is unstable (not history independent)
  // For now we just sort the types to ensure that we always
  // load in the same order.
  const types = Object.keys(db.schemaTypesParsed).sort((a, b) => db.schemaTypesParsed[a].id - db.schemaTypesParsed[b].id).reduce((obj, key) => {
      obj[key] = db.schemaTypesParsed[key];
      return obj;
    },
    {}
  )

  for (const key in types) {
    const def = types[key]
    const [total, lastId] = native.getTypeInfo(def.id, db.dbCtxExternal)
    def.total = total
    def.lastId = writelog?.types[def.id]?.lastId || lastId
    def.blockCapacity =
      writelog?.types[def.id]?.blockCapacity || DEFAULT_BLOCK_CAPACITY

    foreachBlock(db, def, (start, end, hash) => {
      const mtKey = makeCsmtKey(def.id, start)
      const file: string =
        writelog.rangeDumps[def.id]?.find((v) => v.start === start)?.file || ''
      const data: CsmtNodeRange = {
        file,
        typeId: def.id,
        start,
        end,
      }
      db.merkleTree.insert(mtKey, hash, data)
    })
  }

  if (writelog?.hash) {
    const oldHash = Buffer.from(writelog.hash, 'hex')
    const newHash = db.merkleTree.getRoot()?.hash
    if (!oldHash.equals(newHash)) {
      console.error(
        `WARN: CSMT hash mismatch: ${writelog.hash} != ${Buffer.from(newHash).toString('hex')}`,
      )
    }
  }

  // start workers
  let i = availableParallelism()
  const address: BigInt = native.intFromExternal(db.dbCtxExternal)

  db.workers = new Array(i)

  while (i--) {
    db.workers[i] = new DbWorker(address, db)
  }

  if (!opts?.hosted) {
    db.unlistenExit = exitHook(async (signal) => {
      const blockSig = () => {}
      const signals = ['SIGINT', 'SIGTERM', 'SIGHUP'];

      // A really dumb way to block signals temporarily while saving.
      // This is needed because there is no way to set the process signal mask
      // in Node.js.
      signals.forEach((sig) => process.on(sig, blockSig))

      console.log(`Exiting with signal: ${signal}`)
      save(db, true)
      console.log('Successfully saved.')

      signals.forEach((sig) => process.off(sig, blockSig))
    })
  }
}
