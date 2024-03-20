import {
  Worker,
  isMainThread,
  parentPort,
  workerData,
} from 'node:worker_threads'

import { BasedClient } from '@based/client'

const client = new BasedClient()

client.connect({
  url: 'ws://localhost:9910',
})
console.log('START')

client.once('connect', () => {
  console.log('CONNECT')
})

const bla = async () => {
  for (let j = 0; j < 20; j++) {
    let q = []
    let id = (~~(Math.random() * 10000)).toString(16)

    const writes = []
    for (let i = 0; i < 1e4; i++) {
      writes.push('a' + id + i)
      writes.push(i + '    ' + 'flurp ballz smurti')

      // q.push(client.call('hello', { key: 'a' + id + i, value: i + '' }))
    }

    // console.log(writes)

    q.push(
      client.call('hello', { writes }).catch((e) => {
        console.error('errr..')
      }),
    )
    await Promise.all(q)
  }
}
bla().then(() => {
  parentPort.postMessage('done')
})
