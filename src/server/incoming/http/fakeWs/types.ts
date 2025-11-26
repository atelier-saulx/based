import type { Context, HttpSession } from '../../../../functions/index.js'
import { BasedServer } from '../../../server.js'

export type FakeBinaryMessageHandler = (
  arr: Uint8Array,
  start: number,
  len: number,
  isDeflate: boolean,
  ctx: Context<HttpSession>,
  server: BasedServer,
) => Promise<Uint8Array> | void
