import { Context, HttpSession, HttpHeaders } from '@based/functions'
import { Duplex, Readable } from 'stream'
import { compress } from './compress.js'

export const end = (
  ctx: Context<HttpSession>,
  payload?: string | Buffer | Uint8Array,
) => {
  if (!ctx.session) {
    return
  }
  if (ctx.session.method !== 'options') {
    ctx.session.res.writeHeader('Access-Control-Allow-Headers', '*')
    ctx.session.res.writeHeader('Access-Control-Expose-Headers', '*')
    ctx.session.res.writeHeader('Access-Control-Allow-Origin', '*')
  }
  if (payload === undefined || ctx.session.method === 'options') {
    ctx.session.res.end()
  } else {
    ctx.session.res.end(payload)
  }
  ctx.session.res = null
  ctx.session.req = null
  if (ctx.session.onClose) {
    ctx.session.onClose()
  }
  ctx.session = null
}

export const sendHeaders = (
  ctx: Context<HttpSession>,
  headers: HttpHeaders,
) => {
  for (const header in headers) {
    const value = headers[header]
    ctx.session.res.writeHeader(
      header,
      Array.isArray(value)
        ? value.join(',')
        : typeof value === 'string'
          ? value
          : String(value),
    )
  }
}

export const sendHttpResponse = (
  ctx: Context<HttpSession>,
  result: any,
  headers?: HttpHeaders,
  statusCode: string = '200 OK',
) => {
  // handle custom http response here...
  if (!ctx.session) {
    return
  }

  let cType: string
  let parsed: string | Buffer

  if (result === undefined) {
    ctx.session.res.cork(() => {
      ctx.session.res.writeStatus(statusCode)
      if (headers) {
        sendHeaders(ctx, headers)
      }

      if (ctx.session.onClose) {
        ctx.session.onClose()
      }

      ctx.session.res.end()
    })
    return
  } else if (typeof result === 'string' || result instanceof Buffer) {
    cType = 'text/plain'
    parsed = result
    // TODO: more check here
  } else if (result instanceof Readable || result instanceof Duplex) {
    ctx.session.res.cork(() => {
      ctx.session.res.writeStatus(statusCode)
      if (headers) {
        sendHeaders(ctx, headers)
      }
    })
    result.on('data', (d) => {
      ctx.session.res.cork(() => {
        ctx.session?.res.write(d)
      })
    })
    result.on('end', () => {
      ctx.session.res.cork(() => {
        if (ctx.session) {
          if (ctx.session.onClose) {
            ctx.session.onClose()
          }
          ctx.session.res.end()
        }
      })
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
      : ctx.session.headers.encoding,
  ).then(({ payload, encoding }) => {
    if (ctx.session?.res) {
      ctx.session.res.cork(() => {
        ctx.session.res.writeStatus(statusCode)

        if (headers) {
          sendHeaders(ctx, headers)
          if (!('Cache-Control' in headers || 'cache-control' in headers)) {
            ctx.session.res.writeHeader(
              'Cache-Control',
              'max-age=0, must-revalidate',
            )
          }
          if (
            !(
              'Strict-Transport-Security' in headers ||
              'strict-transport-security' in headers
            )
          ) {
            ctx.session.res.writeHeader(
              'Strict-Transport-Security',
              'max-age=31536000; includeSubDomains; preload',
            )
          }
          if (!('Content-Type' in headers || 'content-type' in headers)) {
            ctx.session.res.writeHeader('Content-Type', cType)
          }
        } else {
          ctx.session.res.writeHeader(
            'Cache-Control',
            'max-age=0, must-revalidate',
          )
          ctx.session.res.writeHeader(
            'Strict-Transport-Security',
            'max-age=31536000; includeSubDomains; preload',
          )
        }

        if (encoding) {
          ctx.session.res.writeHeader('Content-Encoding', encoding)
        }

        end(ctx, payload)
      })
    }
  })
}
