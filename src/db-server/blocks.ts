import native, { idGenerator } from '../native.js'
import { readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import {
  ENCODER,
  readInt32,
  writeUint16,
  writeUint32,
} from '../utils/index.js'
import { DbServer } from './index.js'
import { OpType } from '../zigTsExports.js'
import { COMMON_SDB_FILE } from '../index.js'

export type BlockHash = Uint8Array
export const BLOCK_HASH_SIZE = 16

export type SaveOpts = {
  skipDirtyCheck?: boolean
  skipMigrationCheck?: boolean
}

const SELVA_ENOENT = -8

const loadSaveCommonId = idGenerator()
const saveAllBlocksId = idGenerator()
const loadBlockRawId = idGenerator()
const getBlockHashId = idGenerator()

async function saveCommon(db: DbServer): Promise<void> {
  const id = loadSaveCommonId.next().value
  const filename = join(db.fileSystemPath, COMMON_SDB_FILE)
  const msg = new Uint8Array(5 + native.stringByteLength(filename) + 1)

  writeUint32(msg, id, 0)
  msg[4] = OpType.saveCommon
  ENCODER.encodeInto(filename, msg.subarray(5))

  return new Promise((resolve, reject) => {
    db.addOpOnceListener(OpType.saveCommon, id, (buf: Uint8Array) => {
      const err = readInt32(buf, 0)
      if (err) {
        const errMsg = `Save common failed: ${native.selvaStrerror(err)}`
        db.emit('error', errMsg)
        reject(new Error(errMsg))
      } else {
        resolve()
      }
    })

    native.query(msg, db.dbCtxExternal)
  })
}

function saveAllBlocks(db: DbServer): Promise<number> {
  const id = saveAllBlocksId.next().value
  const msg = new Uint8Array(5)

  writeUint32(msg, id, 0)
  msg[4] = OpType.saveAllBlocks

  return new Promise((resolve, reject) => {
    db.addOpOnceListener(OpType.saveAllBlocks, id, (buf: Uint8Array) => {
      const err = readInt32(buf, 0)
      if (err) {
        const errMsg = `Save common failed: ${native.selvaStrerror(err)}`
        db.emit('error', errMsg)
        reject(new Error(errMsg))
      } else {
        const nrBlocks = readInt32(buf, 4)
        resolve(nrBlocks)
      }
    })

    native.query(msg, db.dbCtxExternal)
  })
}

export async function loadCommon(
  db: DbServer,
  filename: string,
): Promise<void> {
  const id = loadSaveCommonId.next().value
  const msg = new Uint8Array(5 + native.stringByteLength(filename) + 1)

  writeUint32(msg, id, 0)
  msg[4] = OpType.loadCommon
  ENCODER.encodeInto(filename, msg.subarray(5))

  return new Promise((resolve, reject) => {
    db.addOpOnceListener(OpType.loadCommon, id, (buf: Uint8Array) => {
      const err = readInt32(buf, 0)
      if (err) {
        // TODO read errlog
        const errMsg = `Save common failed: ${native.selvaStrerror(err)}`
        db.emit('error', errMsg)
        reject(new Error(errMsg))
      } else {
        resolve()
      }
    })

    native.modify(msg, db.dbCtxExternal)
  })
}

export async function loadBlockRaw(
  db: DbServer,
  typeId: number,
  start: number,
  filename: string,
): Promise<Uint8Array> {
  const id = loadBlockRawId.next().value
  const msg = new Uint8Array(11 + native.stringByteLength(filename) + 1)

  writeUint32(msg, id, 0)
  msg[4] = OpType.loadBlock
  writeUint32(msg, start, 5)
  writeUint16(msg, typeId, 9)
  ENCODER.encodeInto(filename, msg.subarray(11))

  return new Promise((resolve, reject) => {
    db.addOpOnceListener(OpType.loadBlock, id, (buf: Uint8Array) => {
      const err = readInt32(buf, 0)
      if (err) {
        // TODO read errlog
        const errMsg = `Load ${basename(filename)} failed: ${native.selvaStrerror(err)}`
        db.emit('error', errMsg)
        reject(new Error(errMsg))
      } else {
        const hash = buf.slice(10, 10 + BLOCK_HASH_SIZE)
        resolve(hash)
      }
    })

    native.modify(msg, db.dbCtxExternal)
  })
}

export async function getBlockHash(
  db: DbServer,
  typeCode: number,
  start: number,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const id = getBlockHashId.next().value
    const msg = new Uint8Array(11)

    writeUint32(msg, id, 0)
    msg[4] = OpType.blockHash
    writeUint32(msg, start, 5)
    writeUint16(msg, typeCode, 9)

    db.addOpOnceListener(OpType.blockHash, id, (buf: Uint8Array) => {
      const err = readInt32(buf, 0)
      if (err) {
        reject(
          new Error(
            `getBlockHash ${typeCode}:${start} failed: ${native.selvaStrerror(err)}`,
          ),
        )
      } else {
        resolve(buf.slice(4, 20))
      }
    })

    native.query(msg, db.dbCtxExternal)
  })
}

function inhibitSave(
  db: DbServer,
  { skipMigrationCheck }: SaveOpts,
): boolean {
  if (db.migrating && !skipMigrationCheck) {
    db.emit('info', 'Block save db is migrating')
    return true
  }

  if (db.saveInProgress) {
    db.emit('info', 'Already have a save in progress cancel save')
    return true
  }
  return false
}

export async function save(db: DbServer, opts: SaveOpts = {}): Promise<void> {
  if (inhibitSave(db, opts)) {
    return
  }

  let ts = Date.now()
  db.saveInProgress = true

  try {
    await saveCommon(db)
    const nrBlocks = await saveAllBlocks(db)
    console.log(`nrBlocks: ${nrBlocks}`)
    // TODO block until all blocks have been written?

    db.emit('info', `Save took ${Date.now() - ts}ms`)
  } catch (err) {
    db.emit('error', `Save failed ${err.message}`)
    throw err
  } finally {
    db.saveInProgress = false
  }
}
