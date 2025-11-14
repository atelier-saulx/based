import { registerMsgHandler } from './worker.ts'
import native from '../../native.ts'

registerMsgHandler((dbCtx: any, msg: any) => native.getQueryBuf(msg, dbCtx))
