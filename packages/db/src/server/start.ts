import { DbServer, DbWorker, SCHEMA_FILE, WRITELOG_FILE } from './index.js'
import native from '../native.js'
import { rm, mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { hashEq } from './csmt/index.js'
import { CsmtNodeRange, foreachBlock, initCsmt, makeCsmtKey } from './tree.js'
import { availableParallelism } from 'node:os'
import exitHook from 'exit-hook'
import './worker.js'
import { save, Writelog } from './save.js'
import { DEFAULT_BLOCK_CAPACITY } from '@based/schema/def'
import { bufToHex, hexToBuf } from '@saulx/utils'

export async function start(
  db: DbServer,
  opts: { clean?: boolean; hosted?: boolean },
) {
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
      // Prop need to not call setting in selva
      await db.setSchema(JSON.parse(schema.toString()), true)
    }
  } catch (err) {
    // TODO In some cases we really should give up!
  }

  const csmtTypes = initCsmt(db)

  for (const key in csmtTypes) {
    const def = csmtTypes[key]
    const [total, lastId] = native.getTypeInfo(def.id, db.dbCtxExternal)
    def.total = total
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
    const oldHash = hexToBuf(writelog.hash)
    const newHash = db.merkleTree.getRoot()?.hash
    if (!hashEq(oldHash, newHash)) {
      console.error(
        `WARN: CSMT hash mismatch. expected: ${writelog.hash} actual: ${bufToHex(newHash)}`,
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
    db.unlistenExit = exitHook((signal) => {
      const blockSig = () => {}
      const signals = ['SIGINT', 'SIGTERM', 'SIGHUP']

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

  if (db.saveIntervalInSeconds > 0) {
    db.saveInterval ??= setInterval(() => {
      save(db)
    }, db.saveIntervalInSeconds * 1e3)
  }
}
