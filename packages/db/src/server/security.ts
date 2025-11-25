import { BasedErrorCode } from '../errors/index.js'
import type {
  Context,
  HttpSession,
  WebSocketSession,
} from '../functions/index.js'
import type { BasedServer } from './server.js'
import uws from '../uws/index.js'

enum IsBlocked {
  notBlocked = 0,
  blocked = 1,
  firstBlocked = 2,
}

// TODO add tests and put on server
const blockedEvents = new Set()

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
    if (blockedEvents.size) {
      server.emit('error', server.client.ctx, {
        code: BasedErrorCode.Block,
        blockedEvents,
      })
      blockedEvents.clear()
    }
  }, 30e3)
}

const incomingRequestCounter = (
  server: BasedServer,
  ip: string,
  tokens: number,
  max: number,
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
  max: number,
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
    res.end()
  })
}

export const blockIncomingRequest = (
  server: BasedServer,
  ip: string,
  res: uws.HttpResponse,
  req: uws.HttpRequest,
  max: number,
  tokens: number,
): boolean => {
  if (server.allowedIps.has(ip)) {
    return false
  }
  if (server.blockedIps.has(ip)) {
    if (blockedEvents.size < 1e3) {
      blockedEvents.add(ip)
    }
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
          origin: req.getHeader('origin'),
          headers: {},
          ua: req.getHeader('user-agent'),
          ip,
        },
      },
      { code: BasedErrorCode.RateLimit },
    )
  }
  endRateLimitHttp(res)
  return true
}
