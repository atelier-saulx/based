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
    server.rateLimitCounter.forEach((value, ip) => {
      if (value.requests <= 0) {
        server.rateLimitCounter.delete(ip)
        return
      }
      value.requests -= server.rateLimit.drain
    })
    if (server.rateLimitCounter.size) {
      drainRequestCounter(server)
    }
  }, 30e3)
}

const incomingRequestCounter = (
  server: BasedServer,
  ip: string,
  tokens: number,
  max: number
): IsBlocked => {
  let ipReqCounter = server.rateLimitCounter.get(ip)
  if (!ipReqCounter) {
    ipReqCounter = {
      requests: tokens,
    }
    server.rateLimitCounter.set(ip, ipReqCounter)
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

export const endRateLimitHttp = (res: uws.HttpResponse) => {
  res.cork(() => {
    res.writeStatus('429 Too Many Requests')
    res.close()
  })
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
    res.close()
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

  endRateLimitHttp(res)

  return true
}