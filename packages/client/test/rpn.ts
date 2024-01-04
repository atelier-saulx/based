import anyTest, { TestFn } from 'ava'
import { BasedDbClient } from '../src'
import { startOrigin } from '../../server/dist'
import { SelvaServer } from '../../server/dist/server'
import { wait } from '@saulx/utils'
import './assertions'
import getPort from 'get-port'

const test = anyTest as TestFn<{
  srv: SelvaServer
  client: BasedDbClient
  port: number
}>

test.before(async (t) => {
  t.context.port = await getPort()
  console.log('origin')
  t.context.srv = await startOrigin({
    port: t.context.port,
    name: 'default',
  })

  console.log('connecting')
  t.context.client = new BasedDbClient()
  t.context.client.connect({
    port: t.context.port,
    host: '127.0.0.1',
  })
})

test.after.always(async (t) => {
  const { srv, client } = t.context
  await srv.destroy()
  client.destroy()
  await wait(500)
})

test('eval boolean expressions', async (t) => {
  const { client } = t.context

  // test ternary
  const expr1 = '#1 #0 @1 T'
  t.deepEqual(
    await client.command('rpn.evalBool', ['node123456', expr1, '0']),
    [1n]
  )
  t.deepEqual(
    await client.command('rpn.evalBool', ['node123456', expr1, '1']),
    [0n]
  )

  // Test duplicate
  t.deepEqual(
    await client.command('rpn.evalBool', ['node123456', '#1 R A']),
    [1n]
  )
})

test('eval to double', async (t) => {
  const { client } = t.context

  // Test ternary
  const expr1 = '@2 #1 A @2 #2 A @1 T'
  t.deepEqual(
    await client.command('rpn.evalDouble', ['node123456', expr1, '0', '3']),
    [4]
  )
  t.deepEqual(
    await client.command('rpn.evalDouble', ['node123456', expr1, '1', '3']),
    [5]
  )

  // Test duplicate
  // 1 + 1
  t.deepEqual(
    await client.command('rpn.evalDouble', ['node123456', '#1 R A']),
    [2]
  )

  // Test swap, duplicate, and forward jump
  // a > 5 ? 0 : a
  const expr2 = '@1 R #5 S I >2 #0 D .2:X'
  t.deepEqual(
    await client.command('rpn.evalDouble', ['node123456', expr2, '3']),
    [0]
  )
  t.deepEqual(
    await client.command('rpn.evalDouble', ['node123456', expr2, '6']),
    [6]
  )

  // Drop
  t.deepEqual(
    await client.command('rpn.evalDouble', ['node123456', '#3 #2 U']),
    [3]
  )

  // drop, forward jump, and swap
  // a > 5 ? 0 : a
  const expr3 = '@2 @1 R #5 H >1 S .1:U'
  t.deepEqual(
    await client.command('rpn.evalDouble', ['node123456', expr3, '3', '6']),
    [3]
  )
  t.deepEqual(
    await client.command('rpn.evalDouble', ['node123456', expr3, '10', '6']),
    [6]
  )

  // Over
  // a * (a + b)
  t.deepEqual(
    await client.command('rpn.evalDouble', ['node123456', '#2 #3 V A D']),
    [10]
  )

  // rotate
  //   ab - bc
  // = 4 * (10 - 5)
  const expr4 = '@3 @2 @1 W B D'
  t.deepEqual(
    await client.command('rpn.evalDouble', ['node123456', expr4, '10', '4', '5']),
    [4 * (10 - 5)]
  )
})

test('eval to string', async (t) => {
  const { client } = t.context

  t.deepEqual(
    await client.command('rpn.evalString', ['node123456', '"hello"']),
    ['hello']
  )

  // a + 1 == 2 ? "true" : "false"
  const expr1 = '@1 #1 A #2 F L >3 "true" #1 >1 .3:"false" .1:X'
  t.deepEqual(
    await client.command('rpn.evalString', ['node123456', expr1, '1']),
    ['true']
  )
  t.deepEqual(
    await client.command('rpn.evalString', ['node123456', expr1, '0']),
    ['false']
  )
})
