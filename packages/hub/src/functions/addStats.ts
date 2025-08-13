import { DbClient } from '@based/db'
import {
  BasedFunctionConfig,
  Session,
  isWsSession,
  isHttpSession,
} from '@based/functions'
import { createEvent } from './event.js'

export const addStats = (
  config: BasedFunctionConfig & { statsId: number },
  statsDb: DbClient,
): BasedFunctionConfig => {
  // make a custom based DB wrapper client
  // based client itself

  //   setInterval(async () => {

  //   }, 3000)

  const sendStats = async (session: Session, d: number) => {
    await statsDb.update('function', config.statsId, {
      uniqueVisitors:
        isWsSession(session) || isHttpSession(session)
          ? [session.ip + session.ua]
          : [],
      totalRequests: { increment: 1 },
      execTime: Math.round(performance.now() - d),
    })
    const fn = await statsDb.query('function', config.statsId).get().toObject()
    createEvent(
      statsDb,
      config.statsId,
      `Unique vistors:${fn.uniqueVisitors} Requests:${fn.totalRequests} Errors:${fn.totalErrors} ExecTime:${fn.execTime}`,
      'runtime',
      'info',
    )
  }

  if (config.type === 'function') {
    return {
      // wrapped based client
      ...config,
      fn: async (based, _payload, ctx) => {
        const d = performance.now()

        try {
          const result = await config.fn(based, _payload, ctx)
          sendStats(ctx, d)
          return result
        } catch (e) {
          statsDb.update('function', config.statsId, {
            totalErrors: { increment: 1 },
          })
          if (ctx.session) {
            sendStats(ctx.session, d)
          }
          // check if person went away during ctx session
          createEvent(statsDb, config.statsId, e.message, 'runtime', 'error')
          throw e
        }
      },
    }
  }

  return config
}
