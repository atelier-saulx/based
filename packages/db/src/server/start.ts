import { stringHash } from '@saulx/hash'
import { DbServer, DbWorker } from './index.js'
import native from '../native.js'
import { rm, mkdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { createTree } from './csmt/index.js'
import { foreachBlock } from './tree.js'
import { availableParallelism } from 'node:os'
import { Worker, MessageChannel } from 'node:worker_threads'
import './worker.js'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const SCHEMA_FILE = 'schema.json'
const WRITELOG_FILE = 'writelog.json'
const DEFAULT_BLOCK_CAPACITY = 100_000

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

export async function start(this: DbServer, { clean }: { clean?: boolean }) {
  const path = this.fileSystemPath
  const id = stringHash(path) >>> 0
  const noop = () => {}

  if (clean) {
    await rm(path, { recursive: true, force: true }).catch(noop)
  }

  await mkdir(path, { recursive: true }).catch(noop)

  // not doing this yet
  // this.modifyBuf = new SharedArrayBuffer(this.maxModifySize)
  this.dbCtxExternal = native.start(path, false, id)

  let writelog: Writelog = null
  try {
    writelog = JSON.parse(
      (await readFile(join(path, WRITELOG_FILE))).toString(),
    )

    // Load the common dump
    native.loadCommon(join(path, writelog.commonDump), this.dbCtxExternal)

    // Load all range dumps
    for (const typeId in writelog.rangeDumps) {
      const dumps = writelog.rangeDumps[typeId]
      for (const dump of dumps) {
        const fname = dump.file
        const err = native.loadRange(join(path, fname), this.dbCtxExternal)
        if (err) {
          console.log(`Failed to load a range. file: "${fname}": ${err}`)
        }
      }
    }

    const schema = await readFile(join(path, SCHEMA_FILE))
    if (schema) {
      // Prop need to not call setting in selva
      this.putSchema(JSON.parse(schema.toString()), true)
    }
  } catch (err) {}

  // The merkle tree should be empty at start.
  if (!this.merkleTree || this.merkleTree.getRoot()) {
    this.merkleTree = createTree(this.createCsmtHashFun)
  }

  for (const key in this.schemaTypesParsed) {
    const def = this.schemaTypesParsed[key]
    const [total, lastId] = native.getTypeInfo(def.id, this.dbCtxExternal)

    def.total = total
    def.lastId = writelog?.types[def.id].lastId || lastId
    def.blockCapacity =
      writelog?.types[def.id].blockCapacity || DEFAULT_BLOCK_CAPACITY

    foreachBlock(this, def, (start, end, hash) => {
      const mtKey = makeCsmtKey(def.id, start)
      const file: string =
        writelog.rangeDumps[def.id].find((v) => v.start === start)?.file || ''
      const data: CsmtNodeRange = {
        file,
        typeId: def.id,
        start,
        end,
      }
      this.merkleTree.insert(mtKey, hash, data)
    })
  }

  if (writelog?.hash) {
    const oldHash = Buffer.from(writelog.hash, 'hex')
    const newHash = this.merkleTree.getRoot()?.hash
    if (!oldHash.equals(newHash)) {
      console.error(
        `WARN: CSMT hash mismatch: ${writelog.hash} != ${newHash.toString('hex')}`,
      )
    }
  }

  // start workers
  let i = availableParallelism()
  const address = native.intFromExternal(this.dbCtxExternal)

  this.workers = new Array(i)

  while (i--) {
    this.workers[i] = new DbWorker(address)
  }
}
