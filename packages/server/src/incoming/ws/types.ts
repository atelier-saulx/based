import { BasedServer } from '../../server'
import { WebSocketSession, Context } from '@based/functions'

export type BinaryMessageHandler = (
  arr: Uint8Array,
  start: number,
  len: number,
  isDeflate: boolean,
  ctx: Context<WebSocketSession>,
  server: BasedServer
) => boolean
