import { BasedServer } from '../../server.js'
import { WebSocketSession, Context } from '@based/functions'

export type BinaryMessageHandler = (
  arr: Uint8Array,
  start: number,
  len: number,
  isDeflate: boolean,
  ctx: Context<WebSocketSession>,
  server: BasedServer,
) => boolean
