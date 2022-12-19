import { BasedErrorCode } from './error'
import type { BasedServer } from './server'
import uws from '@based/uws'
import { HttpSession, WebSocketSession, Context } from './context'

enum IsBlocked {
  notBlocked = 0,
  blocked = 1,
  firstBlocked = 2,
}

const drainRequestCounter = (server: BasedServer) => {
  server.requestsCounterInProgress = true
  server.requestsCounterTimeout = setTimeout(() => {
    server.requestsCounterInProgress = false
    server.requestsCounter.forEach((value, ip) => {
      if (!value.errors?.size) {
        if (value.requests <= 0) {
          server.requestsCounter.delete(ip)
          return
        }
      } else {
        console.info('error handle different')
      }
      console.info('DRAIN RATELIMIT TOKENS')
      value.requests -= 500
    })
    if (server.requestsCounter.size) {
      drainRequestCounter(server)
    }
  }, 30e3)
}

export const rateLimitRequest = (
  server: BasedServer,
  ctx: Context<WebSocketSession | HttpSession>,
  tokens: number,
  max: number
): boolean => {
  if (!ctx.session) {
    return false
  }
  const ip = ctx.session.ip
  const code = incomingRequestCounter(server, ip, tokens, max)
  if (code === 0) {
    return false
  }
  if (code === 2) {
    server.emit('error', ctx, { code: BasedErrorCode.RateLimit })
  }
  return true
}

export const blockIncomingRequest = (
  server: BasedServer,
  ip: string,
  res: uws.HttpResponse,
  req: uws.HttpRequest,
  max: number,
  tokens: number
): boolean => {
  if (server.allowedIps.has(ip)) {
    return false
  }
  if (server.blockedIps.has(ip)) {
    res.end()
    return true
  }
  const code = incomingRequestCounter(server, ip, tokens, max)
  if (code === 0) {
    return false
  }
  if (code === 2) {
    server.emit(
      'error',
      {
        session: {
          ua: req.getHeader('user-agent'),
          ip,
        },
      },
      { code: BasedErrorCode.RateLimit }
    )
  }
  res.writeStatus('429 Too Many Requests')
  res.end()
  return true
}

const incomingRequestCounter = (
  server: BasedServer,
  ip: string,
  tokens: number,
  max: number
): IsBlocked => {
  let ipReqCounter = server.requestsCounter.get(ip)
  if (!ipReqCounter) {
    ipReqCounter = {
      requests: tokens,
    }
    server.requestsCounter.set(ip, ipReqCounter)
  } else {
    ipReqCounter.requests += tokens
  }
  if (ipReqCounter.requests === max) {
    return 2
  }
  if (ipReqCounter.requests > max) {
    return 1
  }
  if (!server.requestsCounterInProgress) {
    drainRequestCounter(server)
  }
  return 0
}
