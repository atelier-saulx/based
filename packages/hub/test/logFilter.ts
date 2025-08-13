import { initS3 } from '@based/s3'
import connect from '@based/client'
import start from '../src/index.js'
import { rm } from 'fs/promises'
import { wait } from '@based/utils'

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

  let i = 1
  while (i--) {
    await statsDb.create('event', {
      function: 1,
      msg: `Lorem ipsum dol62118, consectetur adipisci, nisi nisl aliquam enim, eget facilisis enim nisl nec elit. Pellentesquehabitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Suspendisse potenti. Etiam euismod, urna eu tincidunt consectetur, nisi nisl aliquam enim, eget facilisis enim nisl nec elit. Pellentesque habitant mor │ bi.`,
      type: 'init',
      level: 'info',
      // meta: 'yyy'.repeat(1000),
    })
  }

  console.log('created')

  const q = []
  for (let i = 0; i < 1; i++) {
    q.push(
      new Promise<void>((resolve) =>
        client
          .query('based:events', {
            search: 'dol' + i,
            page: 0,
          })
          .subscribe(
            (res) => {
              console.log(res)
              resolve()
            },
            (err) => {
              console.error(err)
            },
          ),
      ),
    )
  }
  await Promise.all(q).catch((err) => {
    console.error(err)
  })
  console.log('done')

  await wait(2e3)

  await client.destroy()
  await close()
  // process.exit(1)
}

await test()
