import test from 'ava'
import { BasedDbClient } from '../dist'
import { startOrigin } from '../../server/dist'
import { wait } from '@saulx/utils'

test.serial('create connection', async (t) => {
  const server = await startOrigin({
    port: 8081,
    name: 'default',
  })

  await wait(3e3)
  console.info('HELLO HELLO')

  const client = new BasedDbClient({ port: 8081, host: '127.0.0.1' })

  await wait(3e3)

  t.true(true)
})
