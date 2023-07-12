import test from 'ava'
import { BasedDbClient } from '../src'
import { ModifyOpSetType } from '../src/protocol/encode/modify/types'
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
  t.true(cmds[0].length > 5)

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

test.serial('object.set and get', async (t) => {
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

test.serial('object.set big multi-frame string', async (t) => {
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

  t.true(true)
})

test.serial('modify and and object.get', async (t) => {
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

  const id = 'ma00000000000001'
  const resp = await client.command('modify', [
    id,
    ['3', 'num', 15, '0', 'title', 'lololo yes', 'A', 'doubleStuff', 22.89],
  ])
  t.deepEqual(resp, [[id, 'UPDATED', 'UPDATED', 'UPDATED']])
  console.log('SUCCESS', resp)

  let getResult = (await client.command('object.get', ['', id]))[0]
  console.log('get result', getResult)

  getResult.splice(
    getResult.findIndex((x) => {
      return x === 'createdAt'
    }),
    2
  )
  getResult.splice(
    getResult.findIndex((x) => {
      return x === 'updatedAt'
    }),
    2
  )

  t.deepEqual(
    getResult.sort(),
    [
      'id',
      id,
      'title',
      'lololo yes',
      'num',
      BigInt(15),
      'doubleStuff',
      22.89,
    ].sort()
  )

  const id2 = 'ma00000000000002'
  const resp2 = await client.command('modify', [
    id2,
    ['3', 'num', 25, '0', 'title', 'hmm no', 'A', 'doubleStuff', 12.21],
  ])
  console.log('RESP 2', resp2)

  getResult = (await client.command('object.get', ['', id2]))[0]
  console.log('get result', getResult)

  getResult.splice(
    getResult.findIndex((x) => {
      return x === 'createdAt'
    }),
    2
  )
  getResult.splice(
    getResult.findIndex((x) => {
      return x === 'updatedAt'
    }),
    2
  )

  t.deepEqual(
    getResult.sort(),
    [
      'id',
      id2,
      'title',
      'hmm no',
      'num',
      BigInt(25),
      'doubleStuff',
      12.21,
    ].sort()
  )

  getResult = await client.command('object.get', ['', id2, 'parents'])
  console.log('PARENTS', getResult)

  client.destroy()
  await server.destroy()

  t.true(true)
})
