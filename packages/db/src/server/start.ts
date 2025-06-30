import { DbServer } from './index.js'
import { IoWorker } from './IoWorker.js'
import { QueryWorker } from './QueryWorker.js'
import native from '../native.js'
import { rm, mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  VerifTree,
  makeTreeKey,
} from './tree.js'
import {
  foreachBlock,
} from './blocks.js'
import { availableParallelism } from 'node:os'
import exitHook from 'exit-hook'
import { save, Writelog } from './save.js'
import { BLOCK_CAPACITY_DEFAULT } from '@based/schema/def'
import { bufToHex, equals, hexToBuf, wait } from '@saulx/utils'
import { SCHEMA_FILE, WRITELOG_FILE } from '../types.js'
import { setSchemaOnServer } from './schema.js'

export type StartOpts = {
  clean?: boolean
  hosted?: boolean
  delayInMs?: number
  queryThreads?: number
}

function startWorkers(db: DbServer, opts: StartOpts) {
  const queryThreads = opts?.queryThreads ?? availableParallelism()
  const address: BigInt = native.intFromExternal(db.dbCtxExternal)

  db.workers = []
  for (let i = 0; i < queryThreads; i++) {
    db.workers.push(new QueryWorker(address, db, i))
  }

  //db.ioWorker = new IoWorker(address, db)
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
  let partials: [number, Uint8Array][] = [] // Blocks that exists but were not loaded [key, hash]
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

    const schema = await readFile(join(path, SCHEMA_FILE))
    if (schema) {
      const s = JSON.parse(schema.toString())
      setSchemaOnServer(db, s)
    }

    // Load all range dumps
    for (const typeId in writelog.rangeDumps) {
      const dumps = writelog.rangeDumps[typeId]
      const def = db.schemaTypesParsedById[typeId]
      for (const dump of dumps) {
        const fname = dump.file
        if (fname?.length > 0) {
          if (!def.partial) {
            try {
              // Can't use loadBlock() yet because verifTree is not avail
              native.loadBlock(join(path, fname), db.dbCtxExternal)
            } catch (e) {
              console.error(e.message)
            }
          } else {
            partials.push([makeTreeKey(def.id, dump.start), hexToBuf(dump.hash)])
          }
        }
      }
    }
  } catch (err) {
    // TODO In some cases we really should give up!
  }

  db.verifTree = new VerifTree(db.schemaTypesParsed)

  for (const { typeId } of db.verifTree.types()) {
    const def = db.schemaTypesParsedById[typeId]
    const [total, lastId] = native.getTypeInfo(def.id, db.dbCtxExternal)
    def.lastId = writelog?.types[def.id]?.lastId || lastId
    def.blockCapacity =
      writelog?.types[def.id]?.blockCapacity || def.blockCapacity || BLOCK_CAPACITY_DEFAULT

    foreachBlock(
      db,
      def,
      (start, _end, hash) => {
        const mtKey = makeTreeKey(def.id, start)
        db.verifTree.update(mtKey, hash)
      },
    )
  }

  // Insert partials to make the hash match
  for (const [key, hash] of partials) {
    db.verifTree.update(key, hash, false)
  }

  if (writelog?.hash) {
    const oldHash = hexToBuf(writelog.hash)
    const newHash = db.verifTree.hash

    if (!equals(oldHash, newHash)) {
      console.error(
        `WARN: DB hash mismatch. expected: ${writelog.hash} actual: ${bufToHex(newHash)}`,
      )
    }
  }

  startWorkers(db, opts)

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

  await Promise.all(db.workers.map(({ readyPromise }) => readyPromise))
  db.emit('info', 'All workers ready')

  // use timeout
  if (db.saveIntervalInSeconds > 0) {
    db.saveInterval ??= setInterval(() => {
      void save(db)
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
