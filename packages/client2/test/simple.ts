import test from 'ava'
import { startOrigin, SelvaServer } from '@based/db-server'
import getPort from 'get-port'
import { BasedDbClient } from '../src/index.js'
import { wait } from '@saulx/utils'

test('simple test', async (t) => {
  const port = await getPort()
  const originServer = await startOrigin({
    port,
    name: 'default',
  })

  const client = new BasedDbClient()
  client.connect({
    port,
    host: '127.0.0.1',
  })

  client.on('connect', () => {
    console.log('CONNECT!')
  })

  const nodeId = 'flap'

  const node = await client.command('modify', [
    nodeId,
    '',
    ['0', '0', 'hello world!'],
  ])

  console.log(node)

  const result = await client
    .command('object.get', ['', nodeId])
    .catch(console.error)

  console.log(result)

  // client.command('object.set').then((v) => {
  //   console.info(v)
  // })

  await wait(1e3)

  t.true(true)
})
