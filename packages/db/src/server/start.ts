import { DbServer } from './index.js'
import native from '../native.js'
import { rm, mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { BlockMap, makeTreeKey } from './blockMap.js'
import {
  readWritelog,
  foreachBlock,
  registerBlockIoListeners,
  loadCommon,
  loadBlockRaw,
} from './blocks.js'
import { asyncExitHook } from 'exit-hook'
import { deSerialize, type SchemaOut } from '@based/schema'
import { BLOCK_CAPACITY_DEFAULT } from '@based/schema/def'
import { bufToHex, equals, hexToBuf, readUint32, wait } from '@based/utils'
import { SCHEMA_FILE, WRITELOG_FILE, SCHEMA_FILE_DEPRECATED } from '../types.js'
import { setSchemaOnServer } from './schema.js'
import {
  OpTypeEnum,
  BridgeResponseEnum,
  BridgeResponse,
} from '../zigTsExports.js'

export type StartOpts = {
  clean?: boolean
  hosted?: boolean
  noLoadDumps?: boolean
  delayInMs?: number
  queryThreads?: number
}

const handleQueryResponse = (db: DbServer, arr: ArrayBuffer[] | null) => {
  if (!arr) {
    return
  }
  for (const buf of arr) {
    if (!buf) {
      console.error('Thread has no response :(')
      continue
    } else {
      const v = new Uint8Array(buf)
      for (let i = 0; i < v.byteLength; ) {
        const size = readUint32(v, i)
        const id = readUint32(v, i + 4)
        const type: OpTypeEnum = v[i + 8] as OpTypeEnum
        db.execOpListeners(type, id, v.subarray(i + 9, i + size))
        i += size
      }
    }
  }
}

const handleModifyResponse = (db: DbServer, arr: ArrayBuffer) => {
  const v = new Uint8Array(arr)
  for (let i = 0; i < v.byteLength; ) {
    const size = readUint32(v, i)
    const type: OpTypeEnum = v[i + 8] as OpTypeEnum
    const id = readUint32(v, i + 4)
    db.execOpListeners(type, id, v.subarray(i + 9, i + size))
    i += size
  }
}

export async function start(db: DbServer, opts: StartOpts) {
  const path = db.fileSystemPath
  const noop = () => {}

  if (opts?.clean) {
    await rm(path, { recursive: true, force: true }).catch(noop)
  }

  await mkdir(path, { recursive: true }).catch(noop)

  db.dbCtxExternal = native.start((id: BridgeResponseEnum, buffer: any) => {
    if (id === BridgeResponse.query) {
      handleQueryResponse(db, buffer)
    } else if (id === BridgeResponse.modify) {
      handleModifyResponse(db, buffer)
    }
  })

  const writelog = await readWritelog(join(path, WRITELOG_FILE))
  let partials: [number, Uint8Array][] = [] // Blocks that exists but were not loaded [key, hash]

  if (writelog) {
    // Load the common dump
    try {
      await loadCommon(db, join(path, writelog.commonDump))
    } catch (e) {
      console.error(e.message)
      throw e
    }

    // Load schema
    const schema = await readFile(join(path, SCHEMA_FILE)).catch(noop)
    if (schema) {
      const s = deSerialize(schema)
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
              await loadBlockRaw(db, def.id, dump.start, join(path, fname))
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

    const blockGen = foreachBlock(db, def)
    for await (const [start, _end, hash] of blockGen) {
      const mtKey = makeTreeKey(def.id, start)
      db.blockMap.updateBlock(mtKey, hash)
    }
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

  // From now on we can use normal block saving and loading
  registerBlockIoListeners(db)

  if (!opts?.hosted) {
    db.unlistenExit = asyncExitHook(
      async (signal) => {
        const blockSig = () => {}
        const signals = ['SIGINT', 'SIGTERM', 'SIGHUP']
        // A really dumb way to block signals temporarily while saving.
        // This is needed because there is no way to set the process signal mask
        // in Node.js.
        signals.forEach((sig) => process.on(sig, blockSig))
        db.emit('info', `Exiting with signal: ${signal}`)
        await db.save()
        db.emit('info', 'Successfully saved.')
        signals.forEach((sig) => process.off(sig, blockSig))
      },
      { wait: 5000 },
    )
  }

  // use timeout
  if (db.saveIntervalInSeconds > 0) {
    db.saveInterval ??= setInterval(() => {
      db.save()
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
