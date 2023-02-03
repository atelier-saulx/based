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

  // check for 'headers set'
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

export const sendHttpResponse = (
  ctx: Context<HttpSession>,
  result: any,
  headers?: { [key: string]: string | string[] },
  statusCode: string = '200 OK'
) => {
  // handle custom http response here...
  if (!ctx.session) {
    return
  }

  let cType: string

  // for functions there is never cache (idea is they are used to execute - observable fns are for cache)
  let parsed: string
  if (typeof result === 'string') {
    cType = 'text/plain'
    parsed = result
  } else if (result instanceof Readable || result instanceof Duplex) {
    // received stream....
    ctx.session.res.cork(() => {
      ctx.session.res.writeStatus(statusCode)
      if (headers) {
        for (const header in headers) {
          const value = headers[header]
          ctx.session.res.writeHeader(
            header,
            Array.isArray(value) ? value.join(',') : value
          )
          if (
            header === 'Access-Control-Allow-Origin' ||
            header === 'access-control-allow-origin'
          ) {
            ctx.session.corsSend = true
          }
        }
      }
      if (!ctx.session.corsSend) {
        ctx.session.res.writeHeader('Access-Control-Allow-Origin', '*')
        ctx.session.res.writeHeader('Access-Control-Allow-Headers', '*')
      }
    })
    result.on('data', (d) => {
      ctx.session?.res.write(d)
    })
    result.on('end', () => {
      ctx.session?.res.end()
    })
    return
  } else {
    cType = 'application/json'
    parsed = JSON.stringify(result)
  }

  compress(
    parsed,
    headers && ('Content-Encoding' in headers || 'content-encoding' in headers)
      ? undefined
      : ctx.session.headers.encoding
  ).then(({ payload, encoding }) => {
    if (ctx.session.res) {
      ctx.session.res.cork(() => {
        ctx.session.res.writeStatus(statusCode)

        if (headers) {
          for (const header in headers) {
            const value = headers[header]
            ctx.session.res.writeHeader(
              header,
              Array.isArray(value) ? value.join(',') : value
            )
            if (
              header === 'Access-Control-Allow-Origin' ||
              header === 'access-control-allow-origin'
            ) {
              ctx.session.corsSend = true
            }
          }
          if (!('Cache-Control' in headers || 'cache-control' in headers)) {
            ctx.session.res.writeHeader(
              'Cache-Control',
              'max-age=0, must-revalidate'
            )
          }
          if (!('Content-Type' in headers || 'content-type' in headers)) {
            ctx.session.res.writeHeader('Content-Type', cType)
          }
        } else {
          ctx.session.res.writeHeader(
            'Cache-Control',
            'max-age=0, must-revalidate'
          )
          ctx.session.res.writeHeader('Content-Type', cType)
        }

        if (encoding) {
          ctx.session.res.writeHeader('Content-Encoding', encoding)
        }
        end(ctx, payload)
      })
    }
  })
}
