import { DbServer } from './index.js'
import { DbWorker } from './DbWorker.js'
import native from '../native.js'
import { rm, mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  CsmtNodeRange,
  destructureCsmtKey,
  foreachBlock,
  initCsmt,
  makeCsmtKey,
  specialBlock,
} from './tree.js'
import { availableParallelism } from 'node:os'
import exitHook from 'exit-hook'
import { save, Writelog } from './save.js'
import { DEFAULT_BLOCK_CAPACITY } from '@based/schema/def'
import { bufToHex, wait } from '@saulx/utils'
import { SCHEMA_FILE, WRITELOG_FILE } from '../types.js'
import { setSchemaOnServer } from './schema.js'

export type StartOpts = {
  clean?: boolean
  hosted?: boolean
  delayInMs?: number
  queryThreads?: number
}

export async function start(db: DbServer, opts: StartOpts) {
  const path = db.fileSystemPath
  const noop = () => {}

  if (opts?.clean) {
    await rm(path, { recursive: true, force: true }).catch(noop)
  }

  await mkdir(path, { recursive: true }).catch(noop)

  db.dbCtxExternal = native.start()

  let writelog: Writelog = null
  try {
    writelog = JSON.parse(
      (await readFile(join(path, WRITELOG_FILE))).toString(),
    )

    // Load the common dump
    try {
      native.loadCommon(join(path, writelog.commonDump), db.dbCtxExternal)
    } catch (e) {
      console.error(e.message)
      throw e
    }

    // Load all range dumps
    for (const typeId in writelog.rangeDumps) {
      const dumps = writelog.rangeDumps[typeId]
      for (const dump of dumps) {
        const fname = dump.file
        if (fname?.length > 0) {
          try {
            native.loadRange(join(path, fname), db.dbCtxExternal)
          } catch (e) {
            console.error(e.message)
          }
        }
      }
    }

    const schema = await readFile(join(path, SCHEMA_FILE))
    if (schema) {
      const s = JSON.parse(schema.toString())
      setSchemaOnServer(db, s)
    }
  } catch (err) {
    // TODO In some cases we really should give up!
  }

  const csmtTypes = initCsmt(db)

  for (const key in csmtTypes) {
    const def = csmtTypes[key]
    const [total, lastId] = native.getTypeInfo(def.id, db.dbCtxExternal)
    def.lastId = writelog?.types[def.id]?.lastId || lastId
    def.blockCapacity =
      writelog?.types[def.id]?.blockCapacity || DEFAULT_BLOCK_CAPACITY

    foreachBlock(
      db,
      def,
      (start, end, hash) => {
        const mtKey = makeCsmtKey(def.id, start)
        const file: string =
          writelog.rangeDumps[def.id]?.find((v) => v.start === start)?.file ||
          ''
        const data: CsmtNodeRange = {
          file,
          typeId: def.id,
          start,
          end,
        }
        db.merkleTree.insert(mtKey, hash, data)
      },
      true,
    )
  }

  if (writelog?.hash) {
    // FIXME FDN-1301
    //const oldHash = hexToBuf(writelog.hash)
    //const newHash = db.merkleTree.getRoot()?.hash
    //if (!hashEq(oldHash, newHash)) {
    //  console.error(
    //    `WARN: CSMT hash mismatch. expected: ${writelog.hash} actual: ${bufToHex(newHash)}`,
    //  )
    //}

    const oldHashSet = new Set<string>()
    const newHashSet = new Set<string>()

    for (let k in writelog.rangeDumps)
      writelog.rangeDumps[k].forEach(({ hash }) => oldHashSet.add(hash))
    db.merkleTree.visitLeafNodes(({ key, hash }) => {
      const [_typeId, start] = destructureCsmtKey(key)
      if (start == specialBlock) return // skip the type specialBlock
      newHashSet.add(bufToHex(hash))
    })
    const setEq = <T>(a: Set<T>, b: Set<T>) =>
      a.size === b.size && [...a].every((value) => b.has(value))
    if (!setEq(oldHashSet, newHashSet)) {
      console.error(`WARN: CSMT hash mismatch.`)
    }
  }

  // start workers
  const queryThreads = opts?.queryThreads ?? availableParallelism()
  const address: BigInt = native.intFromExternal(db.dbCtxExternal)

  db.workers = []
  for (let i = 0; i < queryThreads; i++) {
    db.workers.push(new DbWorker(address, db, i))
  }

  if (!opts?.hosted) {
    db.unlistenExit = exitHook((signal) => {
      const blockSig = () => {}
      const signals = ['SIGINT', 'SIGTERM', 'SIGHUP']
      // A really dumb way to block signals temporarily while saving.
      // This is needed because there is no way to set the process signal mask
      // in Node.js.
      signals.forEach((sig) => process.on(sig, blockSig))
      db.emit('info', `Exiting with signal: ${signal}`)
      save(db, true)
      db.emit('info', 'Successfully saved.')
      signals.forEach((sig) => process.off(sig, blockSig))
    })
  }

  const d = performance.now()
  await Promise.all(db.workers.map(({ readyPromise }) => readyPromise))
  db.emit('info', `Starting workers took ${d}ms`)

  // use timeout
  if (db.saveIntervalInSeconds > 0) {
    db.saveInterval ??= setInterval(() => {
      save(db)
    }, db.saveIntervalInSeconds * 1e3)
  }

  if (db.schema) {
    db.emit('schema', db.schema)
  }

  if (opts?.delayInMs) {
    db.delayInMs = opts.delayInMs
    await wait(opts.delayInMs)
  }
}
