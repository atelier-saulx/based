import { BasedErrorCode } from '../error'
import type { BasedServer } from '../server'
import uws from '@based/uws'

// add for ws

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

export const incomingCounter = (
  server: BasedServer,
  ip: string,
  req: uws.HttpRequest
): boolean => {
  let ipReqCounter = server.requestsCounter.get(ip)
  if (!ipReqCounter) {
    ipReqCounter = {
      requests: 1,
    }
    server.requestsCounter.set(ip, ipReqCounter)
  } else {
    ipReqCounter.requests++
  }

  if (ipReqCounter.requests === 999) {
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
  if (ipReqCounter.requests > 1000) {
    return true
  }
  if (!server.requestsCounterInProgress) {
    drainRequestCounter(server)
  }
  return false
}
