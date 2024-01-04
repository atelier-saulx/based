import test from 'ava'
import { BasedDbClient } from '../src'
import { startOrigin } from '../../server/dist'
import { wait } from '@saulx/utils'
import getPort from 'get-port'

test('ping', async (t) => {
  // const TIME = 2500

  const port = await getPort()
  const server = await startOrigin({
    port,
    name: 'default',
  })

  const client = new BasedDbClient()

  client.connect({
    port,
    host: '127.0.0.1',
  })

  const pong = await client.command('ping')
  t.deepEqual(pong, ['pong'])

  const cmds = await client.command('lscmd')
  console.log(cmds)
  t.true(cmds[0].length > 5)

  client.destroy()
  await server.destroy()
  await wait(300)

  t.true(true)
})

test('echo', async (t) => {
  const port = await getPort()

  const server = await startOrigin({
    port,
    name: 'default',
  })

  const client = new BasedDbClient()

  client.connect({
    port,
    host: '127.0.0.1',
  })

  const echoed = await client.command('echo', 'lololo yes')
  t.deepEqual(echoed, ['lololo yes'])

  client.destroy()
  await server.destroy()
  await wait(300)

  t.true(true)
})

test('object.set and get', async (t) => {
  const port = await getPort()

  const server = await startOrigin({
    port,
    name: 'default',
  })

  const client = new BasedDbClient()

  client.connect({
    port,
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
  await wait(300)

  t.true(true)
})

// test.serial('object.set wrong arity', async (t) => {
// const TIME = 2500
//
// const server = await startOrigin({
// port: 8082,
// name: 'default',
// })
//
// const client = new BasedDbClient()
//
// client.connect({
// port: 8082,
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

test('object.set wrong node', async (t) => {
  const port = await getPort()

  const server = await startOrigin({
    port,
    name: 'default',
  })

  const client = new BasedDbClient()

  client.connect({
    port,
    host: '127.0.0.1',
  })

  await t.throwsAsync(
    client.command('object.set', ['durr', 'title', 's', 'lololo yes'])
  )

  client.destroy()
  await server.destroy()
  await wait(300)

  t.true(true)
})

test('object.set big multi-frame string', async (t) => {
  const port = await getPort()

  const server = await startOrigin({
    port,
    name: 'default',
  })

  const client = new BasedDbClient()

  client.connect({
    port,
    host: '127.0.0.1',
  })

  let str = ''
  for (let i = 0; i < 2000000; i++) {
    str += 'lololo yes'
  }

  console.log(str.length / 1024 / 1024)

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

  t.deepEqual(getResult[0], str)

  client.destroy()
  await server.destroy()
  await wait(300)

  t.true(true)
})
