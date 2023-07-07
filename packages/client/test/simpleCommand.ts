import test from 'ava'
import { BasedDbClient } from '../dist'
import { startOrigin } from '../../server/dist'
import { wait } from '@saulx/utils'

test.serial('ping', async (t) => {
  const TIME = 2500

  const server = await startOrigin({
    port: 8081,
    name: 'default',
  })

  const client = new BasedDbClient()

  client.connect({
    port: 8081,
    host: '127.0.0.1',
  })

  const pong = await client.command('ping')
  t.deepEqual(pong, ['pong'])

  const cmds = await client.command('lscmd')
  console.log(cmds)
  t.true(cmds.length > 5)

  client.destroy()
  await server.destroy()

  t.true(true)
})

test.serial('echo', async (t) => {
  const TIME = 2500

  const server = await startOrigin({
    port: 8081,
    name: 'default',
  })

  const client = new BasedDbClient()

  client.connect({
    port: 8081,
    host: '127.0.0.1',
  })

  const echoed = await client.command('echo', 'lololo yes')
  t.deepEqual(echoed, ['lololo yes'])

  client.destroy()
  await server.destroy()

  t.true(true)
})

test.serial('object.set', async (t) => {
  const TIME = 2500

  const server = await startOrigin({
    port: 8081,
    name: 'default',
  })

  const client = new BasedDbClient()

  client.connect({
    port: 8081,
    host: '127.0.0.1',
  })

  const success = await client.command('object.set', [
    'root',
    'title',
    's',
    'lololo yes',
  ])
  t.deepEqual(success[0], BigInt(1))
  console.log('SUCCESS', success)

  const getResult = await client.command('object.get', ['', 'root', 'title'])
  console.log('get result', getResult)

  t.deepEqual(getResult[0], 'lololo yes')

  client.destroy()
  await server.destroy()

  t.true(true)
})

// test.serial('object.set wrong arity', async (t) => {
// const TIME = 2500
//
// const server = await startOrigin({
// port: 8081,
// name: 'default',
// })
//
// const client = new BasedDbClient()
//
// client.connect({
// port: 8081,
// host: '127.0.0.1',
// })
//
// await t.throwsAsync(client.command('object.set', ['root', 'title']))
//
// client.destroy()
// await server.destroy()
//
// t.true(true)
// })

test.serial('object.set wrong node', async (t) => {
  const TIME = 2500

  const server = await startOrigin({
    port: 8081,
    name: 'default',
  })

  const client = new BasedDbClient()

  client.connect({
    port: 8081,
    host: '127.0.0.1',
  })

  await t.throwsAsync(
    client.command('object.set', ['durr', 'title', 's', 'lololo yes'])
  )

  client.destroy()
  await server.destroy()

  t.true(true)
})

test.serial.only('object.set big multi-frame string', async (t) => {
  const TIME = 2500

  const server = await startOrigin({
    port: 8081,
    name: 'default',
  })

  const client = new BasedDbClient()

  client.connect({
    port: 8081,
    host: '127.0.0.1',
  })

  await wait(3e3)

  let str = ''
  for (let i = 0; i < 11000; i++) {
    str += 'lololo yes'
  }

  const success = await client.command('object.set', [
    'root',
    'title',
    's',
    str,
  ])
  t.deepEqual(success[0], BigInt(1))
  console.log('SUCCESS', success)

  const getResult = await client.command('object.get', ['', 'root', 'title'])
  console.log('get result', getResult)

  t.deepEqual(getResult[0], 'lololo yes')

  client.destroy()
  await server.destroy()

  t.true(true)
})
