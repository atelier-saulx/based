import { registerMsgHandler } from './worker.js'
import native from '../../native.js'

registerMsgHandler((dbCtx: any, msg: any) => native.getQueryBuf(msg, dbCtx))
