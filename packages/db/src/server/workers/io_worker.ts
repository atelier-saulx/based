import { registerMsgHandler } from './worker.js'
import { IoJob } from './io_worker_types.js'
import { ENCODER, writeInt32 } from '@saulx/utils'
import native from '../../native.js'

function loadBlock(dbCtx: any, filepath: string): null | ArrayBuffer {
  try {
    native.loadBlock(filepath, dbCtx)
  } catch (e) {
    // need to get rid of the shared buffer
    return new Uint8Array(ENCODER.encode(e.toString())).buffer
  }
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
