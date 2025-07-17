import { DbClient } from '@based/db'

export const createEvent = (
  statsDb: DbClient,
  name: string,
  checksum: number,
  msg: string,
  type: 'init' | 'deploy' | 'runtime' | 'security',
  level: 'info' | 'error' | 'warn' | 'debug',
  meta?: string,
) => {
  if (msg && msg.length > 3e3) {
    msg = msg.slice(0, 3e3) + `...(${msg.length - 3e3} more characters)`
  }
  // if (type === 'error') {
  //   const x = msg.split('\n')
  //   for (let i = 1; i < x.length; i++) {
  //     if (x[i].includes('at')) {
  //       x[i] = x[i].split('at')[0]
  //     }
  //   }
  //   msg = [x[0], ...x.slice(2, 6)].join('\n')
  //   msg = msg.replace(/^Error: /, '')
  // }
  statsDb
    .upsert('function', {
      name,
      checksum,
    })
    .then((id) => {
      statsDb
        .create('event', {
          function: id,
          msg,
          type,
          level,
          meta,
        })
        .catch((e) => {
          console.error('failed writing to log', e)
        })
    })
}
