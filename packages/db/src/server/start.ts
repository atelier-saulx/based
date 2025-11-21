import { availableParallelism } from 'node:os'
import { DbServer } from './index.js'
import { QueryWorker } from './QueryWorker.js'
import { IoWorker } from './IoWorker.js'
import native from '../native.js'
import { rm, mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { BlockMap, makeTreeKey } from './blockMap.js'
import { foreachBlock } from './blocks.js'
import exitHook from 'exit-hook'
import { save, saveSync, Writelog } from './save.js'
import { DbSchema, deSerialize } from '@based/schema'
import { BLOCK_CAPACITY_DEFAULT } from '@based/schema/def'
import { bufToHex, equals, hexToBuf, readUint32, wait } from '@based/utils'
import { SCHEMA_FILE, WRITELOG_FILE, SCHEMA_FILE_DEPRECATED } from '../types.js'
import { setSchemaOnServer } from './schema.js'

export type StartOpts = {
  clean?: boolean
  hosted?: boolean
  noLoadDumps?: boolean
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
  db.ioWorker = new IoWorker(address, db)
}

// tmp
const handleQueryWorkerResponse = (
  server: DbServer,
  arr: ArrayBuffer[] | null,
) => {
  if (!arr) {
    return
  }
  for (const buf of arr) {
    if (!buf) {
      console.error('thread has no response :(')
      continue
    } else {
      const v = new Uint8Array(buf)
      for (let i = 0; i < v.byteLength; ) {
        const size = readUint32(v, i)
        const id = readUint32(v, i + 4)
        const fn = server.queryResponses.get(id)
        if (fn) {
          fn(v.subarray(i + 8, i + size))
        }
        i += size
      }
    }
  }
}

export async function start(db: DbServer, opts: StartOpts) {
  const path = db.fileSystemPath
  const noop = () => {}

  if (opts?.clean) {
    await rm(path, { recursive: true, force: true }).catch(noop)
  }

  await mkdir(path, { recursive: true }).catch(noop)

  db.dbCtxExternal = native.start((id: number, buffer: any) => {
    // maybe dont add the id...
    // use enum
    // native.cnt++
    // console.log('im a little derp', new Uint8Array(xxx), x)
    if (id === 1) {
      handleQueryWorkerResponse(db, buffer)
      // console.log(native.cnt)
      // can be a bit nicer
      // console.log('QUERY RESULTS')
      // console.log(native.getQueryResults(x))
    } else if (id === 2) {
      //
      console.log('MODIFY RESULTS', buffer)
    }
  })

  let writelog: Writelog = null
  let partials: [number, Uint8Array][] = [] // Blocks that exists but were not loaded [key, hash]
  try {
    writelog = JSON.parse(
      (await readFile(join(path, WRITELOG_FILE))).toString(),
    )
  } catch (err) {
    // No dump
  }

  if (writelog) {
    // Load the common dump
    try {
      native.loadCommon(join(path, writelog.commonDump), db.dbCtxExternal)
    } catch (e) {
      console.error(e.message)
      throw e
    }

    // Load schema
    const schema = await readFile(join(path, SCHEMA_FILE)).catch(noop)
    if (schema) {
      const s = deSerialize(schema) as DbSchema
      setSchemaOnServer(db, s)
    } else {
      const schemaJson = await readFile(join(path, SCHEMA_FILE_DEPRECATED))
      if (schemaJson) {
        setSchemaOnServer(db, JSON.parse(schemaJson.toString()))
      }
    }

    // Load block dumps
    for (const typeId in writelog.rangeDumps) {
      const dumps = writelog.rangeDumps[typeId]
      const def = db.schemaTypesParsedById[typeId]

      if (!def.partial && !opts?.noLoadDumps) {
        for (const dump of dumps) {
          const fname = dump.file
          if (fname?.length > 0) {
            try {
              // Can't use loadBlock() yet because blockMap is not avail
              native.loadBlock(join(path, fname), db.dbCtxExternal)
            } catch (e) {
              console.error(e.message)
            }
          }
        }
      } else {
        for (const dump of dumps) {
          const fname = dump.file
          if (fname?.length > 0) {
            partials.push([
              makeTreeKey(def.id, dump.start),
              hexToBuf(dump.hash),
            ])
          }
        }
      }
    }
  }

  db.blockMap = new BlockMap(db.schemaTypesParsed)

  for (const { typeId } of db.blockMap.types()) {
    const def = db.schemaTypesParsedById[typeId]
    def.blockCapacity =
      writelog?.types[def.id]?.blockCapacity ||
      def.blockCapacity ||
      BLOCK_CAPACITY_DEFAULT

    foreachBlock(db, def, (start, _end, hash) => {
      const mtKey = makeTreeKey(def.id, start)
      db.blockMap.updateBlock(mtKey, hash)
    })
  }

  // Insert partials to make the hash match
  for (const [key, hash] of partials) {
    db.blockMap.updateBlock(key, hash, 'fs')
  }

  if (writelog?.hash) {
    const oldHash = hexToBuf(writelog.hash)
    const newHash = db.blockMap.hash

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
      saveSync(db)
      db.emit('info', 'Successfully saved.')
      signals.forEach((sig) => process.off(sig, blockSig))
    })
  }

  await Promise.all(db.workers.map(({ readyPromise }) => readyPromise))
  db.emit('info', 'All workers ready')

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
