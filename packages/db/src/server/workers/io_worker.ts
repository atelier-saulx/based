import { registerMsgHandler } from './worker.js'
import { IoJob } from './io_worker_types.js'
import { ENCODER, writeInt32 } from '@based/utils'
import native from '../../native.js'

function loadBlock(dbCtx: any, filepath: string): null | ArrayBuffer {
  native.loadBlock(filepath, dbCtx)
  return null
}

function unloadBlock(
  dbCtx: any,
  filepath: string,
  typeId: number,
  start: number,
): ArrayBuffer {
  const buf = new ArrayBuffer(20) // [[4 bytes err], [16 bytes hash]]
  const hash = new Uint8Array(buf, 4)
  const err = native.saveBlock(filepath, typeId, start, dbCtx, hash)
  if (err) {
    const errCodeBuf = new Uint8Array(buf, 0, 4)
    writeInt32(errCodeBuf, err, 0)
  } else {
    native.delBlock(dbCtx, typeId, start)
  }

  return buf
}

registerMsgHandler((dbCtx: any, msg: any) => {
  if (typeof msg?.type !== 'string') {
    throw new Error('Invalid message')
  }

  const job: IoJob = msg
  if (job.type === 'save') {
    const LEN = 20
    return job.blocks.reduce(
      (buf, block, index) => {
        const errCodeBuf = new Uint8Array(buf, index * LEN, 4)
        const hash = new Uint8Array(buf, index * LEN + 4, 16)
        const err = native.saveBlock(
          block.filepath,
          block.typeId,
          block.start,
          dbCtx,
          hash,
        )
        writeInt32(errCodeBuf, err, 0)
        return buf
      },
      new ArrayBuffer(job.blocks.length * LEN),
    )
  } else if (job.type === 'load') {
    return loadBlock(dbCtx, job.filepath)
  } else if (job.type === 'unload') {
    return unloadBlock(dbCtx, job.filepath, job.typeId, job.start)
  }

  throw new Error(`Unsupported type: "${msg.type}"`)
})
