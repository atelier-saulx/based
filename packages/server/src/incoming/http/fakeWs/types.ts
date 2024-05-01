import { BasedServer } from '../../../server.js'
import { HttpSession, Context } from '@based/functions'

export type FakeBinaryMessageHandler = (
  arr: Uint8Array,
  start: number,
  len: number,
  isDeflate: boolean,
  ctx: Context<HttpSession>,
  server: BasedServer,
) => Promise<Uint8Array> | void
