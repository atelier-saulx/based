import test, { ExecutionContext } from 'ava'
import getPort from 'get-port'
import type { BasedFunctionConfigs } from '../../src/functions/functions.js'
import { BasedServer } from '../../src/server/server.js'

type T = ExecutionContext<{ port: number; ws: string; http: string }>

test.beforeEach(async (t: T) => {
  t.context.port = await getPort()
  t.context.ws = `ws://localhost:${t.context.port}`
  t.context.http = `http://localhost:${t.context.port}`
})

const makeQuery = (path: string) => {
  return {
    bla: {
      type: 'query',
      path,
      closeAfterIdleTime: 3e3,
      uninstallAfterIdleTime: 1e3,
      fn: (_, payload, update) => {
        update(payload)
        return () => {}
      },
    },
  } as BasedFunctionConfigs
}

const makeFunction = (path: string) => {
  return {
    bla: {
      type: 'function',
      path,
      fn: async (_, payload) => payload,
    },
  } as BasedFunctionConfigs
}

test('[query] path extractor with static value and optional parameter', async (t: T) => {
  const server = new BasedServer({
    silent: true,
    port: t.context.port,
    functions: {
      configs: makeQuery('/static/:parameter?'),
    },
    auth: {
      authorize: async () => true,
    },
  })
  await server.start()

  const r1 = await (await fetch(t.context.http + '/static')).json()
  const r2 = await (await fetch(t.context.http + '/static?token=123')).json()
  const r3 = await (await fetch(t.context.http + '/static/')).json()
  const r4 = await (await fetch(t.context.http + '/static/?token=123')).json()
  const r5 = await (await fetch(t.context.http + '/static/fafa')).json()
  const r6 = await (await fetch(t.context.http + '/static/fafa/')).json()
  const r7 = await (await fetch(t.context.http + '/static/123')).json()
  const r8 = await (await fetch(t.context.http + '/static/123/')).json()
  const r9 = await (await fetch(t.context.http + '/bla/static')).json()
  const r10 = await (await fetch(t.context.http + '/bla/static/')).json()
  const r11 = await (await fetch(t.context.http + '/bla/static/fafa')).json()
  const r12 = await (await fetch(t.context.http + '/bla/static/fafa/')).json()
  const r13 = await (await fetch(t.context.http + '/bla/static/123')).json()
  const r14 = await (
    await fetch(t.context.http + '/bla/static/123?token=123')
  ).json()
  const r15 = await (
    await fetch(t.context.http + '/bla/static/123?extra=abc&outro=123')
  ).json()
  const r16 = await (await fetch(t.context.http + '/static/undefined')).json()
  const r17 = await (await fetch(t.context.http + '/static/null')).json()
  const r18 = await (
    await fetch(t.context.http + '/bla/static/undefined')
  ).json()
  const r19 = await (await fetch(t.context.http + '/bla/static/null')).json()

  await server.destroy()

  t.deepEqual(r1, { parameter: '' })
  t.deepEqual(r2, { parameter: '' })
  t.deepEqual(r3, { parameter: '' })
  t.deepEqual(r4, { parameter: '' })
  t.deepEqual(r5, { parameter: 'fafa' })
  t.deepEqual(r6, { parameter: 'fafa' })
  t.deepEqual(r7, { parameter: '123' })
  t.deepEqual(r8, { parameter: '123' })
  t.deepEqual(r9, { parameter: '' })
  t.deepEqual(r10, { parameter: '' })
  t.deepEqual(r11, { parameter: 'fafa' })
  t.deepEqual(r12, { parameter: 'fafa' })
  t.deepEqual(r13, { parameter: '123' })
  t.deepEqual(r14, { parameter: '123' })
  t.deepEqual(r15, { parameter: '123', extra: 'abc', outro: 123 })
  t.deepEqual(r16, { parameter: 'undefined' })
  t.deepEqual(r17, { parameter: 'null' })
  t.deepEqual(r18, { parameter: 'undefined' })
  t.deepEqual(r19, { parameter: 'null' })
})

test('[query] path extractor with static value and required parameter', async (t: T) => {
  const server = new BasedServer({
    silent: true,
    port: t.context.port,
    functions: {
      configs: makeQuery('/static/:parameter'),
    },
    auth: {
      authorize: async () => true,
    },
  })
  await server.start()

  const r1 = await (await fetch(t.context.http + '/static/fafa')).json()
  const r2 = await (await fetch(t.context.http + '/static/fafa/')).json()
  const r3 = await (await fetch(t.context.http + '/static/123')).json()
  const r4 = await (await fetch(t.context.http + '/static/123/')).json()
  const r5 = await (await fetch(t.context.http + '/bla/static/fafa')).json()
  const r6 = await (await fetch(t.context.http + '/bla/static/fafa/')).json()
  const r7 = await (await fetch(t.context.http + '/bla/static/123')).json()
  const r8 = await (
    await fetch(t.context.http + '/bla/static/123?token=123')
  ).json()
  const r9 = await (await fetch(t.context.http + '/bla/static/123/')).json()
  const r10 = await (
    await fetch(t.context.http + '/bla/static/123/?extra=abc&outro=123')
  ).json()
  const r11 = await (await fetch(t.context.http + '/static/undefined')).json()
  const r12 = await (await fetch(t.context.http + '/static/null')).json()
  const r13 = await (
    await fetch(t.context.http + '/bla/static/undefined')
  ).json()
  const r14 = await (await fetch(t.context.http + '/bla/static/null')).json()

  await server.destroy()

  t.deepEqual(r1, { parameter: 'fafa' })
  t.deepEqual(r2, { parameter: 'fafa' })
  t.deepEqual(r3, { parameter: '123' })
  t.deepEqual(r4, { parameter: '123' })
  t.deepEqual(r5, { parameter: 'fafa' })
  t.deepEqual(r6, { parameter: 'fafa' })
  t.deepEqual(r7, { parameter: '123' })
  t.deepEqual(r8, { parameter: '123' })
  t.deepEqual(r9, { parameter: '123' })
  t.deepEqual(r10, { parameter: '123', extra: 'abc', outro: 123 })
  t.deepEqual(r11, { parameter: 'undefined' })
  t.deepEqual(r12, { parameter: 'null' })
  t.deepEqual(r13, { parameter: 'undefined' })
  t.deepEqual(r14, { parameter: 'null' })
})

test('[query] path extractor with static value and multiple required parameters (1 or more)', async (t: T) => {
  const server = new BasedServer({
    silent: true,
    port: t.context.port,
    functions: {
      configs: makeQuery('/static/:parameter+'),
    },
    auth: {
      authorize: async () => true,
    },
  })
  await server.start()

  const r1 = await (await fetch(t.context.http + '/static/fafa')).json()
  const r2 = await (await fetch(t.context.http + '/static/fafa/')).json()
  const r3 = await (await fetch(t.context.http + '/static/fafa/123')).json()
  const r4 = await (await fetch(t.context.http + '/static/fafa/123/')).json()
  const r5 = await (
    await fetch(
      t.context.http +
        '/static/fafa/fefe/fifi/fofo/fufu/fafa/fefe/fifi/fofo/fufu',
    )
  ).json()
  const r6 = await (
    await fetch(
      t.context.http +
        '/static/fafa/fefe/fifi/fofo/fufu/fafa/fefe/fifi/fofo/fufu/',
    )
  ).json()
  const r7 = await (await fetch(t.context.http + '/bla/static/fafa')).json()
  const r8 = await (await fetch(t.context.http + '/bla/static/fafa/')).json()
  const r9 = await (await fetch(t.context.http + '/bla/static/fafa/123')).json()
  const r10 = await (
    await fetch(t.context.http + '/bla/static/fafa/123/')
  ).json()
  const r11 = await (
    await fetch(
      t.context.http +
        '/bla/static/fafa/fefe/fifi/fofo/fufu/fafa/fefe/fifi/fofo/fufu',
    )
  ).json()
  const r12 = await (
    await fetch(
      t.context.http +
        '/bla/static/fafa/fefe/fifi/fofo/fufu/fafa/fefe/fifi/fofo/fufu/',
    )
  ).json()
  const r13 = await (
    await fetch(
      t.context.http +
        '/bla/static/fafa/fefe/fifi/fofo/fufu/fafa/fefe/fifi/fofo/fufu/?token=123',
    )
  ).json()
  const r14 = await (
    await fetch(t.context.http + '/bla/static/fafa/fefe/?extra=abc&outro=123')
  ).json()

  await server.destroy()

  t.deepEqual(r1, { parameter: ['fafa'] })
  t.deepEqual(r2, { parameter: ['fafa'] })
  t.deepEqual(r3, { parameter: ['fafa', '123'] })
  t.deepEqual(r4, { parameter: ['fafa', '123'] })
  t.deepEqual(r5, {
    parameter: [
      'fafa',
      'fefe',
      'fifi',
      'fofo',
      'fufu',
      'fafa',
      'fefe',
      'fifi',
      'fofo',
      'fufu',
    ],
  })
  t.deepEqual(r6, {
    parameter: [
      'fafa',
      'fefe',
      'fifi',
      'fofo',
      'fufu',
      'fafa',
      'fefe',
      'fifi',
      'fofo',
      'fufu',
    ],
  })
  t.deepEqual(r7, { parameter: ['fafa'] })
  t.deepEqual(r8, { parameter: ['fafa'] })
  t.deepEqual(r9, { parameter: ['fafa', '123'] })
  t.deepEqual(r10, { parameter: ['fafa', '123'] })
  t.deepEqual(r11, {
    parameter: [
      'fafa',
      'fefe',
      'fifi',
      'fofo',
      'fufu',
      'fafa',
      'fefe',
      'fifi',
      'fofo',
      'fufu',
    ],
  })
  t.deepEqual(r12, {
    parameter: [
      'fafa',
      'fefe',
      'fifi',
      'fofo',
      'fufu',
      'fafa',
      'fefe',
      'fifi',
      'fofo',
      'fufu',
    ],
  })
  t.deepEqual(r13, {
    parameter: [
      'fafa',
      'fefe',
      'fifi',
      'fofo',
      'fufu',
      'fafa',
      'fefe',
      'fifi',
      'fofo',
      'fufu',
    ],
  })
  t.deepEqual(r14, { parameter: ['fafa', 'fefe'], extra: 'abc', outro: 123 })
})

test('[query] path extractor with static value and multiple optional parameters (0 or more)', async (t: T) => {
  const server = new BasedServer({
    silent: true,
    port: t.context.port,
    functions: {
      configs: makeQuery('/static/:parameter*'),
    },
    auth: {
      authorize: async () => true,
    },
  })
  await server.start()

  const r1 = await (await fetch(t.context.http + '/static')).json()
  const r2 = await (await fetch(t.context.http + '/static/')).json()
  const r3 = await (await fetch(t.context.http + '/static/fafa')).json()
  const r4 = await (await fetch(t.context.http + '/static/fafa/')).json()
  const r5 = await (await fetch(t.context.http + '/static/fafa/123')).json()
  const r6 = await (await fetch(t.context.http + '/static/fafa/123/')).json()
  const r7 = await (
    await fetch(
      t.context.http +
        '/static/fafa/fefe/fifi/fofo/fufu/fafa/fefe/fifi/fofo/fufu',
    )
  ).json()
  const r8 = await (
    await fetch(
      t.context.http +
        '/static/fafa/fefe/fifi/fofo/fufu/fafa/fefe/fifi/fofo/fufu/',
    )
  ).json()
  const r9 = await (await fetch(t.context.http + '/bla/static')).json()
  const r10 = await (await fetch(t.context.http + '/bla/static/')).json()
  const r11 = await (await fetch(t.context.http + '/bla/static/fafa')).json()
  const r12 = await (await fetch(t.context.http + '/bla/static/fafa/')).json()
  const r13 = await (
    await fetch(t.context.http + '/bla/static/fafa/123')
  ).json()
  const r14 = await (
    await fetch(t.context.http + '/bla/static/fafa/123/')
  ).json()
  const r15 = await (
    await fetch(
      t.context.http +
        '/bla/static/fafa/fefe/fifi/fofo/fufu/fafa/fefe/fifi/fofo/fufu',
    )
  ).json()
  const r16 = await (
    await fetch(
      t.context.http +
        '/bla/static/fafa/fefe/fifi/fofo/fufu/fafa/fefe/fifi/fofo/fufu/',
    )
  ).json()
  const r17 = await (
    await fetch(
      t.context.http +
        '/bla/static/fafa/fefe/fifi/fofo/fufu/fafa/fefe/fifi/fofo/fufu/?token=123',
    )
  ).json()
  const r18 = await (
    await fetch(t.context.http + '/bla/static/fafa/fefe/?extra=abc&outro=123')
  ).json()

  await server.destroy()

  t.deepEqual(r1, { parameter: [] })
  t.deepEqual(r2, { parameter: [] })
  t.deepEqual(r3, { parameter: ['fafa'] })
  t.deepEqual(r4, { parameter: ['fafa'] })
  t.deepEqual(r5, { parameter: ['fafa', '123'] })
  t.deepEqual(r6, { parameter: ['fafa', '123'] })
  t.deepEqual(r7, {
    parameter: [
      'fafa',
      'fefe',
      'fifi',
      'fofo',
      'fufu',
      'fafa',
      'fefe',
      'fifi',
      'fofo',
      'fufu',
    ],
  })
  t.deepEqual(r8, {
    parameter: [
      'fafa',
      'fefe',
      'fifi',
      'fofo',
      'fufu',
      'fafa',
      'fefe',
      'fifi',
      'fofo',
      'fufu',
    ],
  })
  t.deepEqual(r9, { parameter: [] })
  t.deepEqual(r10, { parameter: [] })
  t.deepEqual(r11, { parameter: ['fafa'] })
  t.deepEqual(r12, { parameter: ['fafa'] })
  t.deepEqual(r13, { parameter: ['fafa', '123'] })
  t.deepEqual(r14, { parameter: ['fafa', '123'] })
  t.deepEqual(r15, {
    parameter: [
      'fafa',
      'fefe',
      'fifi',
      'fofo',
      'fufu',
      'fafa',
      'fefe',
      'fifi',
      'fofo',
      'fufu',
    ],
  })
  t.deepEqual(r16, {
    parameter: [
      'fafa',
      'fefe',
      'fifi',
      'fofo',
      'fufu',
      'fafa',
      'fefe',
      'fifi',
      'fofo',
      'fufu',
    ],
  })
  t.deepEqual(r17, {
    parameter: [
      'fafa',
      'fefe',
      'fifi',
      'fofo',
      'fufu',
      'fafa',
      'fefe',
      'fifi',
      'fofo',
      'fufu',
    ],
  })
  t.deepEqual(r18, { parameter: ['fafa', 'fefe'], extra: 'abc', outro: 123 })
})

test('[query] path extractor with no static value and a optional parameter', async (t: T) => {
  const server = new BasedServer({
    silent: true,
    port: t.context.port,
    functions: {
      configs: makeQuery('/:parameter?'),
    },
    auth: {
      authorize: async () => true,
    },
  })
  await server.start()

  const r1 = await (await fetch(t.context.http + '/')).json()
  const r2 = await (await fetch(t.context.http + '//')).json()
  const r3 = await (await fetch(t.context.http + '/fafa')).json()
  const r4 = await (await fetch(t.context.http + '/fafa/')).json()
  const r5 = await (await fetch(t.context.http + '/123')).json()
  const r6 = await (await fetch(t.context.http + '/123/')).json()
  const r7 = await (await fetch(t.context.http + '/bla')).json()
  const r8 = await (await fetch(t.context.http + '/bla/')).json()
  const r9 = await (await fetch(t.context.http + '/bla/fafa')).json()
  const r10 = await (await fetch(t.context.http + '/bla/fafa/')).json()
  const r11 = await (await fetch(t.context.http + '/bla/123')).json()
  const r12 = await (await fetch(t.context.http + '/bla/123/')).json()
  const r13 = await (await fetch(t.context.http + '/?token=123')).json()
  const r14 = await (
    await fetch(t.context.http + '/?extra=abc&outro=123')
  ).json()

  await server.destroy()

  t.deepEqual(r1, { parameter: '' })
  t.deepEqual(r2, { parameter: '' })
  t.deepEqual(r3, { parameter: 'fafa' })
  t.deepEqual(r4, { parameter: 'fafa' })
  t.deepEqual(r5, { parameter: '123' })
  t.deepEqual(r6, { parameter: '123' })
  t.deepEqual(r7, { parameter: '' })
  t.deepEqual(r8, { parameter: '' })
  t.deepEqual(r9, { parameter: 'fafa' })
  t.deepEqual(r10, { parameter: 'fafa' })
  t.deepEqual(r11, { parameter: '123' })
  t.deepEqual(r12, { parameter: '123' })
  t.deepEqual(r13, { parameter: '' })
  t.deepEqual(r14, { parameter: '', extra: 'abc', outro: 123 })
})

test('[function] path matcher with static value and optional parameter', async (t: T) => {
  const server = new BasedServer({
    silent: true,
    port: t.context.port,
    functions: {
      configs: makeFunction('/static/:parameter?'),
    },
  })
  await server.start()

  const r1 = await (await fetch(t.context.http + '/static')).json()
  const r2 = await (await fetch(t.context.http + '/static?token=123')).json()
  const r3 = await (await fetch(t.context.http + '/static/')).json()
  const r4 = await (await fetch(t.context.http + '/static/?token=123')).json()
  const r5 = await (await fetch(t.context.http + '/static/fafa')).json()
  const r6 = await (await fetch(t.context.http + '/static/fafa/')).json()
  const r7 = await (await fetch(t.context.http + '/static/123')).json()
  const r8 = await (await fetch(t.context.http + '/static/123/')).json()
  const r9 = await (await fetch(t.context.http + '/bla/static')).json()
  const r10 = await (await fetch(t.context.http + '/bla/static/')).json()
  const r11 = await (await fetch(t.context.http + '/bla/static/fafa')).json()
  const r12 = await (await fetch(t.context.http + '/bla/static/fafa/')).json()
  const r13 = await (await fetch(t.context.http + '/bla/static/123')).json()
  const r14 = await (
    await fetch(t.context.http + '/bla/static/123?token=123')
  ).json()
  const r15 = await (
    await fetch(t.context.http + '/bla/static/123?extra=abc&outro=123')
  ).json()

  await server.destroy()

  t.deepEqual(r1, { parameter: '' })
  t.deepEqual(r2, { parameter: '', token: 123 })
  t.deepEqual(r3, { parameter: '' })
  t.deepEqual(r4, { parameter: '', token: 123 })
  t.deepEqual(r5, { parameter: 'fafa' })
  t.deepEqual(r6, { parameter: 'fafa' })
  t.deepEqual(r7, { parameter: '123' })
  t.deepEqual(r8, { parameter: '123' })
  t.deepEqual(r9, { parameter: '' })
  t.deepEqual(r10, { parameter: '' })
  t.deepEqual(r11, { parameter: 'fafa' })
  t.deepEqual(r12, { parameter: 'fafa' })
  t.deepEqual(r13, { parameter: '123' })
  t.deepEqual(r14, { parameter: '123', token: 123 })
  t.deepEqual(r15, { parameter: '123', extra: 'abc', outro: 123 })
})

test('[function] path matcher with static value and required parameter', async (t: T) => {
  const server = new BasedServer({
    silent: true,
    port: t.context.port,
    functions: {
      configs: makeFunction('/static/:parameter'),
    },
    auth: {
      authorize: async () => true,
    },
  })
  await server.start()

  const r1 = await (await fetch(t.context.http + '/static/fafa')).json()
  const r2 = await (await fetch(t.context.http + '/static/fafa/')).json()
  const r3 = await (await fetch(t.context.http + '/static/123')).json()
  const r4 = await (await fetch(t.context.http + '/static/123/')).json()
  const r5 = await (await fetch(t.context.http + '/bla/static/fafa')).json()
  const r6 = await (await fetch(t.context.http + '/bla/static/fafa/')).json()
  const r7 = await (await fetch(t.context.http + '/bla/static/123')).json()
  const r8 = await (
    await fetch(t.context.http + '/bla/static/123?token=123')
  ).json()
  const r9 = await (await fetch(t.context.http + '/bla/static/123/')).json()
  const r10 = await (
    await fetch(t.context.http + '/bla/static/123?extra=abc&outro=123')
  ).json()

  await server.destroy()

  t.deepEqual(r1, { parameter: 'fafa' })
  t.deepEqual(r2, { parameter: 'fafa' })
  t.deepEqual(r3, { parameter: '123' })
  t.deepEqual(r4, { parameter: '123' })
  t.deepEqual(r5, { parameter: 'fafa' })
  t.deepEqual(r6, { parameter: 'fafa' })
  t.deepEqual(r7, { parameter: '123' })
  t.deepEqual(r8, { parameter: '123', token: 123 })
  t.deepEqual(r9, { parameter: '123' })
  t.deepEqual(r10, { parameter: '123', extra: 'abc', outro: 123 })
})

test('[function] path matcher with static value and multiple required parameters (1 or more)', async (t: T) => {
  const server = new BasedServer({
    silent: true,
    port: t.context.port,
    functions: {
      configs: makeFunction('/static/:parameter+'),
    },
    auth: {
      authorize: async () => true,
    },
  })
  await server.start()

  const r1 = await (await fetch(t.context.http + '/static/fafa')).json()
  const r2 = await (await fetch(t.context.http + '/static/fafa/')).json()
  const r3 = await (await fetch(t.context.http + '/static/fafa/123')).json()
  const r4 = await (await fetch(t.context.http + '/static/fafa/123/')).json()
  const r5 = await (
    await fetch(
      t.context.http +
        '/static/fafa/fefe/fifi/fofo/fufu/fafa/fefe/fifi/fofo/fufu',
    )
  ).json()
  const r6 = await (
    await fetch(
      t.context.http +
        '/static/fafa/fefe/fifi/fofo/fufu/fafa/fefe/fifi/fofo/fufu/',
    )
  ).json()
  const r7 = await (await fetch(t.context.http + '/bla/static/fafa')).json()
  const r8 = await (await fetch(t.context.http + '/bla/static/fafa/')).json()
  const r9 = await (await fetch(t.context.http + '/bla/static/fafa/123')).json()
  const r10 = await (
    await fetch(t.context.http + '/bla/static/fafa/123/')
  ).json()
  const r11 = await (
    await fetch(
      t.context.http +
        '/bla/static/fafa/fefe/fifi/fofo/fufu/fafa/fefe/fifi/fofo/fufu',
    )
  ).json()
  const r12 = await (
    await fetch(
      t.context.http +
        '/bla/static/fafa/fefe/fifi/fofo/fufu/fafa/fefe/fifi/fofo/fufu/',
    )
  ).json()
  const r13 = await (
    await fetch(
      t.context.http +
        '/bla/static/fafa/fefe/fifi/fofo/fufu/fafa/fefe/fifi/fofo/fufu/?token=123',
    )
  ).json()
  const r14 = await (
    await fetch(t.context.http + '/bla/static/fafa/fefe/?extra=abc&outro=123')
  ).json()

  await server.destroy()

  t.deepEqual(r1, { parameter: ['fafa'] })
  t.deepEqual(r2, { parameter: ['fafa'] })
  t.deepEqual(r3, { parameter: ['fafa', '123'] })
  t.deepEqual(r4, { parameter: ['fafa', '123'] })
  t.deepEqual(r5, {
    parameter: [
      'fafa',
      'fefe',
      'fifi',
      'fofo',
      'fufu',
      'fafa',
      'fefe',
      'fifi',
      'fofo',
      'fufu',
    ],
  })
  t.deepEqual(r6, {
    parameter: [
      'fafa',
      'fefe',
      'fifi',
      'fofo',
      'fufu',
      'fafa',
      'fefe',
      'fifi',
      'fofo',
      'fufu',
    ],
  })
  t.deepEqual(r7, { parameter: ['fafa'] })
  t.deepEqual(r8, { parameter: ['fafa'] })
  t.deepEqual(r9, { parameter: ['fafa', '123'] })
  t.deepEqual(r10, { parameter: ['fafa', '123'] })
  t.deepEqual(r11, {
    parameter: [
      'fafa',
      'fefe',
      'fifi',
      'fofo',
      'fufu',
      'fafa',
      'fefe',
      'fifi',
      'fofo',
      'fufu',
    ],
  })
  t.deepEqual(r12, {
    parameter: [
      'fafa',
      'fefe',
      'fifi',
      'fofo',
      'fufu',
      'fafa',
      'fefe',
      'fifi',
      'fofo',
      'fufu',
    ],
  })
  t.deepEqual(r13, {
    parameter: [
      'fafa',
      'fefe',
      'fifi',
      'fofo',
      'fufu',
      'fafa',
      'fefe',
      'fifi',
      'fofo',
      'fufu',
    ],
    token: 123,
  })
  t.deepEqual(r14, { parameter: ['fafa', 'fefe'], extra: 'abc', outro: 123 })
})

test('[function] path matcher with static value and multiple optional parameters (0 or more)', async (t: T) => {
  const server = new BasedServer({
    silent: true,
    port: t.context.port,
    functions: {
      configs: makeFunction('/static/:parameter*'),
    },
    auth: {
      authorize: async () => true,
    },
  })
  await server.start()

  const r1 = await (await fetch(t.context.http + '/static')).json()
  const r2 = await (await fetch(t.context.http + '/static/')).json()
  const r3 = await (await fetch(t.context.http + '/static/fafa')).json()
  const r4 = await (await fetch(t.context.http + '/static/fafa/')).json()
  const r5 = await (await fetch(t.context.http + '/static/fafa/123')).json()
  const r6 = await (await fetch(t.context.http + '/static/fafa/123/')).json()
  const r7 = await (
    await fetch(
      t.context.http +
        '/static/fafa/fefe/fifi/fofo/fufu/fafa/fefe/fifi/fofo/fufu',
    )
  ).json()
  const r8 = await (
    await fetch(
      t.context.http +
        '/static/fafa/fefe/fifi/fofo/fufu/fafa/fefe/fifi/fofo/fufu/',
    )
  ).json()
  const r9 = await (await fetch(t.context.http + '/bla/static')).json()
  const r10 = await (await fetch(t.context.http + '/bla/static/')).json()
  const r11 = await (await fetch(t.context.http + '/bla/static/fafa')).json()
  const r12 = await (await fetch(t.context.http + '/bla/static/fafa/')).json()
  const r13 = await (
    await fetch(t.context.http + '/bla/static/fafa/123')
  ).json()
  const r14 = await (
    await fetch(t.context.http + '/bla/static/fafa/123/')
  ).json()
  const r15 = await (
    await fetch(
      t.context.http +
        '/bla/static/fafa/fefe/fifi/fofo/fufu/fafa/fefe/fifi/fofo/fufu',
    )
  ).json()
  const r16 = await (
    await fetch(
      t.context.http +
        '/bla/static/fafa/fefe/fifi/fofo/fufu/fafa/fefe/fifi/fofo/fufu/',
    )
  ).json()
  const r17 = await (
    await fetch(
      t.context.http +
        '/bla/static/fafa/fefe/fifi/fofo/fufu/fafa/fefe/fifi/fofo/fufu/?token=123',
    )
  ).json()
  const r18 = await (
    await fetch(t.context.http + '/bla/static/fafa/fefe/?extra=abc&outro=123')
  ).json()

  await server.destroy()

  t.deepEqual(r1, { parameter: [] })
  t.deepEqual(r2, { parameter: [] })
  t.deepEqual(r3, { parameter: ['fafa'] })
  t.deepEqual(r4, { parameter: ['fafa'] })
  t.deepEqual(r5, { parameter: ['fafa', '123'] })
  t.deepEqual(r6, { parameter: ['fafa', '123'] })
  t.deepEqual(r7, {
    parameter: [
      'fafa',
      'fefe',
      'fifi',
      'fofo',
      'fufu',
      'fafa',
      'fefe',
      'fifi',
      'fofo',
      'fufu',
    ],
  })
  t.deepEqual(r8, {
    parameter: [
      'fafa',
      'fefe',
      'fifi',
      'fofo',
      'fufu',
      'fafa',
      'fefe',
      'fifi',
      'fofo',
      'fufu',
    ],
  })
  t.deepEqual(r9, { parameter: [] })
  t.deepEqual(r10, { parameter: [] })
  t.deepEqual(r11, { parameter: ['fafa'] })
  t.deepEqual(r12, { parameter: ['fafa'] })
  t.deepEqual(r13, { parameter: ['fafa', '123'] })
  t.deepEqual(r14, { parameter: ['fafa', '123'] })
  t.deepEqual(r15, {
    parameter: [
      'fafa',
      'fefe',
      'fifi',
      'fofo',
      'fufu',
      'fafa',
      'fefe',
      'fifi',
      'fofo',
      'fufu',
    ],
  })
  t.deepEqual(r16, {
    parameter: [
      'fafa',
      'fefe',
      'fifi',
      'fofo',
      'fufu',
      'fafa',
      'fefe',
      'fifi',
      'fofo',
      'fufu',
    ],
  })
  t.deepEqual(r17, {
    parameter: [
      'fafa',
      'fefe',
      'fifi',
      'fofo',
      'fufu',
      'fafa',
      'fefe',
      'fifi',
      'fofo',
      'fufu',
    ],
    token: 123,
  })
  t.deepEqual(r18, { parameter: ['fafa', 'fefe'], extra: 'abc', outro: 123 })
})

test('[function] path matcher with no static value and a optional parameter', async (t: T) => {
  const server = new BasedServer({
    silent: true,
    port: t.context.port,
    functions: {
      configs: makeFunction('/:parameter?'),
    },
    auth: {
      authorize: async () => true,
    },
  })
  await server.start()

  const r1 = await (await fetch(t.context.http + '/')).json()
  const r2 = await (await fetch(t.context.http + '//')).json()
  const r3 = await (await fetch(t.context.http + '/fafa')).json()
  const r4 = await (await fetch(t.context.http + '/fafa/')).json()
  const r5 = await (await fetch(t.context.http + '/123')).json()
  const r6 = await (await fetch(t.context.http + '/123/')).json()
  const r7 = await (await fetch(t.context.http + '/bla')).json()
  const r8 = await (await fetch(t.context.http + '/bla/')).json()
  const r9 = await (await fetch(t.context.http + '/bla/fafa')).json()
  const r10 = await (await fetch(t.context.http + '/bla/fafa/')).json()
  const r11 = await (await fetch(t.context.http + '/bla/123')).json()
  const r12 = await (await fetch(t.context.http + '/bla/123/')).json()
  const r13 = await (await fetch(t.context.http + '/?token=123')).json()
  const r14 = await (
    await fetch(t.context.http + '/?extra=abc&outro=123')
  ).json()

  await server.destroy()

  t.deepEqual(r1, { parameter: '' })
  t.deepEqual(r2, { parameter: '' })
  t.deepEqual(r3, { parameter: 'fafa' })
  t.deepEqual(r4, { parameter: 'fafa' })
  t.deepEqual(r5, { parameter: '123' })
  t.deepEqual(r6, { parameter: '123' })
  t.deepEqual(r7, { parameter: '' })
  t.deepEqual(r8, { parameter: '' })
  t.deepEqual(r9, { parameter: 'fafa' })
  t.deepEqual(r10, { parameter: 'fafa' })
  t.deepEqual(r11, { parameter: '123' })
  t.deepEqual(r12, { parameter: '123' })
  t.deepEqual(r13, { parameter: '', token: 123 })
  t.deepEqual(r14, { parameter: '', extra: 'abc', outro: 123 })
})
