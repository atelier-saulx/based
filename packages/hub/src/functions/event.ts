import { DbClient } from '@based/db'

export const createEvent = (
  statsDb: DbClient,
  id: number,
  msg: string,
  type: 'init' | 'deploy' | 'runtime' | 'security',
  level: 'info' | 'error' | 'warn' | 'debug',
  meta?: string,
) => {
  if (msg && msg.length > 3e3) {
    msg = msg.slice(0, 3e3) + `...(${msg.length - 3e3} more characters)`
  }
  statsDb.create('event', {
    function: id,
    msg,
    type,
    level,
    meta,
  })
}
