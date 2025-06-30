import { registerMsgHandler } from './worker.js'
import { IoJob } from './io_worker_types.js'
import { ENCODER, writeInt32 } from '@saulx/utils'
import native from '../../native.js'

function loadBlock(dbCtx: any, filepath: string): null | Uint8Array {
  try {
    native.loadBlock(filepath, dbCtx)
  } catch (e) {
    return ENCODER.encode(e.toString())
  }
  return null
}

function unloadBlock(
  dbCtx: any,
  filepath: string,
  typeId: number,
  start: number,
): Uint8Array {
  const hash = new Uint8Array(16)
  const err = native.saveBlock(filepath, typeId, start, dbCtx, hash)
  if (err) {
    const buf = new Uint8Array(4)
    writeInt32(buf, err, 0)
    return buf
  }

  native.delBlock(dbCtx, typeId, start)
  return hash
}

registerMsgHandler((dbCtx: any, msg: any) => {
  if (typeof msg?.type === 'string') {
    const job: IoJob = msg
    if (job.type === 'load') {
      return loadBlock(dbCtx, job.filepath)
    } else if (job.type === 'unload') {
      return unloadBlock(dbCtx, job.filepath, job.typeId, job.start)
    }
  }
  return null
})
