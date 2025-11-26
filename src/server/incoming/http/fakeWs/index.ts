import type { Context, HttpSession } from '../../../../functions/index.js'
import { BasedServer } from '../../../server.js'
import { handleBinary } from './handleBinary.js'

const MAX_CHUNK_SIZE = 1024 * 1024

// REFACTOR THIS TO USE THE SAME MESSAGE HANDLERS
export const handleFakeWs = (
  server: BasedServer,
  ctx: Context<HttpSession>,
): any => {
  const session = ctx.session!
  const len = session.headers['content-length']!

  if (len > MAX_CHUNK_SIZE * 100 || !len || typeof len !== 'number') {
    session.res.end()
    return
  }

  let total: Buffer
  let lastWritten = 0

  // buffer
  // add length as a header
  session.res.onData((c, isLast) => {
    if (!total) {
      if (!isLast) {
        total = Buffer.allocUnsafe(len)
      } else {
        total = Buffer.from(c)
        handleBinary(server, ctx, total)
        return
      }
    }

    // @ts-ignore
    total.set(c, lastWritten)
    lastWritten += c.byteLength
    if (isLast) {
      handleBinary(server, ctx, total)
    }
  })
}
