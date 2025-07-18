import { initS3 } from '@based/s3'
import connect from '@based/client'
import start from '../src/index.js'
import { rm } from 'fs/promises'
import { wait } from '@saulx/utils'

const test = async () => {
  await rm('./tmp', { recursive: true, force: true })
  const { close, statsDb, configDb } = await start({
    port: 8080,
    path: './tmp',
    s3: initS3({
      provider: 'local',
      localS3Dir: './tmp',
    }),
    buckets: {
      files: './tmp/files',
      backups: './tmp/backups',
      dists: './tmp/dists',
    },
  })

  const client = connect({
    url: 'ws://localhost:8080',
  })

  await client.stream('based:set-function', {
    contents: Buffer.from('export default async () => "test"'),
    payload: {
      config: {
        name: 'test',
        type: 'function',
      },
    },
  })

  await wait(100)

  let i = 1000
  while (i--) {
    await statsDb.create('event', {
      function: 1,
      msg: 'xxx'.repeat(1000),
      type: 'init',
      level: 'info',
      meta: 'yyy'.repeat(1000),
    })
  }

  await new Promise<void>((resolve) =>
    client
      .query('based:events', {
        search: 'derp',
        page: 0,
      })
      .subscribe((res) => {
        console.log(res)
        resolve()
      }),
  )

  await client.destroy()
  await close()
  process.exit(1)
}

test()
