import { registerMsgHandler } from './worker.js'
import native from '../../native.js'

function loadBlock(dbCtx: any, filepath: string)
{
  try {
    native.loadBlock(filepath, dbCtx)
  } catch (e) {
    console.error(e)
  }
}

function unloadBlock(dbCtx: any, filepath: string, typeId: number, start: number): number | Uint8Array {
  const hash = new Uint8Array(16)
  const err = native.saveBlock(
    filepath,
    typeId,
    start,
    dbCtx,
    hash,
  )
  if (err) {
    return err
  }

  native.delBlock(dbCtx, typeId, start)
  return hash
}

// TODO
registerMsgHandler((dbCtx: any, msg: any) => null)
