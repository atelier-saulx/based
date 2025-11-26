import type { Context, WebSocketSession } from '../../../functions/index.js'
import { BasedServer } from '../../server.js'

export type BinaryMessageHandler = (
  arr: Uint8Array,
  start: number,
  len: number,
  isDeflate: boolean,
  ctx: Context<WebSocketSession>,
  server: BasedServer,
) => boolean
