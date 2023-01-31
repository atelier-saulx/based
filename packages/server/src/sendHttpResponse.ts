import { Context, HttpSession } from '@based/functions'
import { Duplex, Readable } from 'stream'
import { compress } from './compress'

export const end = (
  ctx: Context<HttpSession>,
  payload?: string | Buffer | Uint8Array
) => {
  if (!ctx.session) {
    return
  }

  if (!ctx.session.corsSend) {
    ctx.session.res.writeHeader('Access-Control-Allow-Origin', '*')
    ctx.session.res.writeHeader('Access-Control-Allow-Headers', '*')
  }

  if (payload === undefined || ctx.session.method === 'options') {
    ctx.session.res.end()
  } else {
    ctx.session.res.end(payload)
  }

  ctx.session.res = null
  ctx.session.req = null
  ctx.session = null
}

export const sendHttpResponse = (ctx: Context<HttpSession>, result: any) => {
  if (!ctx.session) {
    return
  }

  let cType: string

  // for functions there is never cache (idea is they are used to execute - observable fns are for cache)
  let parsed: string
  if (typeof result === 'string') {
    cType = 'text/plain'
    parsed = result
  } else {
    cType = 'application/json'
    parsed = JSON.stringify(result)
  }

  if (result instanceof Readable || result instanceof Duplex) {
    // received stream....
    ctx.session.res.cork(() => {
      ctx.session.res.writeStatus('200 OK')
      ctx.session.res.writeHeader('Access-Control-Allow-Origin', '*')
      ctx.session.res.writeHeader('Access-Control-Allow-Headers', '*')
      // ctx.session.res.writeHeader(
      //   'Cache-Control',
      //   'max-age=0, must-revalidate'
      // )
    })
    result.on('data', (d) => {
      ctx.session?.res.write(d)
    })
    result.on('end', () => {
      ctx.session?.res.end()
    })
    return
  }

  compress(parsed, ctx.session.headers.encoding).then(
    ({ payload, encoding }) => {
      if (ctx.session.res) {
        ctx.session.res.cork(() => {
          ctx.session.res.writeStatus('200 OK')
          ctx.session.res.writeHeader(
            'Cache-Control',
            'max-age=0, must-revalidate'
          )
          // TODO check this
          // ctx.session.res.writeHeader('Mime-Type', '')
          ctx.session.res.writeHeader('Content-Type', cType)
          if (encoding) {
            ctx.session.res.writeHeader('Content-Encoding', encoding)
          }
          end(ctx, payload)
        })
      }
    }
  )
}
