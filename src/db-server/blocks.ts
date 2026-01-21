import native, { idGenerator } from '../native.js'
import {
  DECODER,
  readInt32,
  readUint16,
  readUint32,
  writeUint16,
  writeUint32,
} from '../utils/index.js'
import { DbServer } from './index.js'
import { OpType } from '../zigTsExports.js'

export type BlockHash = Uint8Array
export const BLOCK_HASH_SIZE = 16

export type SaveOpts = {
  skipDirtyCheck?: boolean
  skipMigrationCheck?: boolean
}

const SELVA_ENOENT = -8

const loadCommonId = idGenerator()
const saveAllBlocksId = idGenerator()
const loadBlockRawId = idGenerator()
const getBlockHashId = idGenerator()

function saveAll(db: DbServer, id: number): Promise<number> {
  const msg = new Uint8Array(5)

  writeUint32(msg, id, 0)
  msg[4] = OpType.saveAll

  return new Promise((resolve, reject) => {
    db.addOpOnceListener(OpType.saveAll, id, (buf: Uint8Array) => {
      const err = readInt32(buf, 0)
      if (err) {
        // In this case save probably failed before any blocks were written.
        const errMsg = `Save failed: ${native.selvaStrerror(err)}`
        const errLog = DECODER.decode(buf.subarray(4))

        console.log(errLog)
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
): Promise<void> {
  const id = loadCommonId.next().value
  const msg = new Uint8Array(5)

  writeUint32(msg, id, 0)
  msg[4] = OpType.loadCommon

  return new Promise((resolve, reject) => {
    db.addOpOnceListener(OpType.loadCommon, id, (buf: Uint8Array) => {
      const err = readInt32(buf, 0)
      if (err) {
        // TODO read errlog
        const errMsg = `Load failed: ${native.selvaStrerror(err)}`
        const errLog = DECODER.decode(buf.subarray(4))

        console.log(errLog)
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
  block: number,
): Promise<Uint8Array> {
  const id = loadBlockRawId.next().value
  const msg = new Uint8Array(15)

  writeUint32(msg, id, 0)
  msg[4] = OpType.loadBlock
  writeUint32(msg, start, 5)
  writeUint16(msg, typeId, 9)
  writeUint32(msg, block, 11)

  return new Promise((resolve, reject) => {
    db.addOpOnceListener(OpType.loadBlock, id, (buf: Uint8Array) => {
      const err = readInt32(buf, 0)
      if (err) {
        // TODO read errlog
        const errMsg = `Load ${typeId}:${block} failed: ${native.selvaStrerror(err)}`
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
  const id = saveAllBlocksId.next().value
  db.saveInProgress = true
  let state = 0
  const p = Promise.withResolvers()

  const updateState = (n: number) => {
    state += n
    if (state === 0) {
      p.resolve(null)
    }
  }
  const saveBlockListener = (buf: Uint8Array) => {
    const err = readInt32(buf, 0)
    if (err) {
      const start = readUint32(buf, 4)
      const typeCode = readUint16(buf, 8)
      const errMsg = `Save block ${typeCode}:${start} failed: ${native.selvaStrerror(err)}`

      db.emit('error', errMsg)
      p.reject(new Error(errMsg))
    } else {
      updateState(1)
    }
  }

  db.addOpListener(OpType.saveBlock, id, saveBlockListener)

  try {
    const nrBlocks = await saveAll(db, id)
    updateState(-nrBlocks)
    await p.promise

    db.emit('info', `Save took ${Date.now() - ts}ms`)
  } catch (err) {
    db.emit('error', `Save failed ${err.message}`)
    throw err
  } finally {
    db.removeOpListener(OpType.saveBlock, id, saveBlockListener)
    db.saveInProgress = false
  }
}
