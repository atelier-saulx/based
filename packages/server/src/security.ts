import { BasedErrorCode } from './error'
import type { BasedServer } from './server'
import uws from '@based/uws'

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

export const blockIncomingRequest = (
  server: BasedServer,
  ip: string,
  res: uws.HttpResponse,
  req: uws.HttpRequest,
  weight: number = 1
): boolean => {
  if (server.allowedIps.has(ip)) {
    return false
  }
  if (server.blockedIps.has(ip)) {
    res.end()
    return true
  }
  if (incomingRequestCounter(server, ip, req, weight)) {
    res.writeStatus('429 Too Many Requests')
    res.end()
    return true
  }
  return false
}

export const incomingRequestCounter = (
  server: BasedServer,
  ip: string,
  req: uws.HttpRequest,
  weight: number
): boolean => {
  let ipReqCounter = server.requestsCounter.get(ip)
  if (!ipReqCounter) {
    ipReqCounter = {
      requests: weight,
    }
    server.requestsCounter.set(ip, ipReqCounter)
  } else {
    ipReqCounter.requests += weight
  }
  if (ipReqCounter.requests === server.rateLimit.http) {
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
  if (ipReqCounter.requests > server.rateLimit.http) {
    return true
  }
  if (!server.requestsCounterInProgress) {
    drainRequestCounter(server)
  }
  return false
}
