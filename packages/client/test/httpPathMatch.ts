import test, { ExecutionContext } from 'ava'
import { BasedServer } from '@based/server'
import fetch from 'cross-fetch'
import getPort from 'get-port'
import { BasedFunctionConfigs } from '@based/functions'

type T = ExecutionContext<{ port: number; ws: string; http: string }>

test.beforeEach(async (t: T) => {
  t.context.port = await getPort()
  t.context.ws = `ws://localhost:${t.context.port}`
  t.context.http = `http://localhost:${t.context.port}`
})

const makeQuery = (
  path: string,
  returnValue: any,
  functionName: string = 'bla',
) => {
  return {
    [functionName]: {
      type: 'query',
      path,
      closeAfterIdleTime: 3e3,
      uninstallAfterIdleTime: 1e3,
      fn: (_, __, update) => {
        update(returnValue)
        return () => {}
      },
    },
  } as BasedFunctionConfigs
}

const makeFunction = (
  path: string,
  returnValue: any,
  functionName: string = 'bla',
) => {
  return {
    [functionName]: {
      type: 'function',
      path,
      fn: async () => ({ result: returnValue, path, functionName }),
    },
  } as BasedFunctionConfigs
}

// FOR FUTURE: now the result is 400ms avg.
// test('path matcher 10 million matches', async (t: T) => {
//   const finalPath = '/static/:parameter?'
//   const tokens = tokenizePattern(Buffer.from(finalPath))
//   const bufferedUrl = Buffer.from('/static/yahoo')
//   let match: boolean = false
//   let i = 0
//   const startTime = performance.now()
//   while (i < 10e6) {
//     match = pathMatcher(tokens, bufferedUrl)
//     i++
//   }
//   console.log(`${((performance.now() - startTime))}ms`)

//   t.true(match)
// })

test.only('basic path matcher', async (t: T) => {
  const functionNames = [
    'based:analytics',
    'based:connections',
    'based:connections-per-hub',
    'based:db-list',
    'based:backups-upload',
    'based:backups-list',
    'based:backups-select',
    'based:backups-download',
    'based:db-flush',
    'db:sql',
    'db:sql-insert',
    'db:sql-update-table',
    'db:sql-remove-table',
    'db:sql-exec',
    'based:observe-views',
    'db',
    'db:schema',
    'db:origins',
    'db:set-schema',
    'db:id',
    'db:set',
    'db:delete',
    'db:get',
    'db:digest',
    'db:copy',
    'based:env-registry',
    'based:env-info',
    'db:file-upload',
    'file:upload',
    'based:set-function',
    'based:remove-function',
    'based:set-sourcemap',
    'based:get-sourcemap',
    'based:graphql-playground',
    'based:graphql',
    'based:logs',
    'based:logs-delete',
    'based:secret',
    'based:set-secret',
    'based:get-secret',
    'based:security-events',
    'based:ping',
  ]

  const server = new BasedServer({
    port: t.context.port,
    functions: {
      configs: {
        ...makeFunction('/', true, 'root'),
        ...makeFunction('/voting', true, 'voting'),
        ...makeFunction('/artists/:name', true, 'artists'),
        ...makeFunction('/musics/:name+', true, 'musics'),
        ...makeFunction('/cms/:path*', true, 'cms'),
        ...makeFunction('/panel/:path*', true, 'a:b'),
        ...functionNames.reduce((res, name) => {
          return Object.assign(res, makeQuery(undefined, true, name))
        }, {}),
      },
    },
    auth: {
      authorize: async () => true,
    },
  })
  await server.start()

  const r1 = await (await fetch(t.context.http + '/')).json()
  const r2 = await (await fetch(t.context.http + '//')).json()
  const r3 = await (await fetch(t.context.http + '///')).json()
  const r4 = await (await fetch(t.context.http + '////')).json()
  const r5 = await (await fetch(t.context.http + '/blablabla/')).json()
  const r6 = await (await fetch(t.context.http + '/undefined/')).json()
  const r7 = await (await fetch(t.context.http + '/null')).json()
  const r8 = await (await fetch(t.context.http + '/static/123/')).json()
  const r9 = await (await fetch(t.context.http + '/voting')).json()
  const r10 = await (await fetch(t.context.http + '/voting/')).json()
  const r11 = await (await fetch(t.context.http + '/voting/static/fafa')).json()
  const r12 = await (await fetch(t.context.http + '/artists')).json()
  const r13 = await (await fetch(t.context.http + '/artists/')).json()
  const r14 = await (await fetch(t.context.http + '/artists/lady-gaga')).json()
  const r15 = await (await fetch(t.context.http + '/artists/lady-gaga/')).json()
  const r16 = await (
    await fetch(t.context.http + '/artists/lady-gaga/beyonce')
  ).json()
  const r17 = await (
    await fetch(t.context.http + '/artists/lady-gaga/beyonce/')
  ).json()
  const r18 = await (await fetch(t.context.http + '/musics')).json()
  const r19 = await (await fetch(t.context.http + '/musics/')).json()
  const r20 = await (
    await fetch(t.context.http + '/musics/oscar-winning-tears')
  ).json()
  const r21 = await (
    await fetch(t.context.http + '/musics/oscar-winning-tears/nosebleeds')
  ).json()
  const r22 = await (
    await fetch(
      t.context.http + '/musics/oscar-winning-tears/nosebleeds/piloto',
    )
  ).json()
  const r23 = await (await fetch(t.context.http + '/cms')).json()
  const r24 = await (await fetch(t.context.http + '/cms/')).json()
  const r25 = await (await fetch(t.context.http + '/cms/login')).json()
  const r26 = await (await fetch(t.context.http + '/cms/users/luigui')).json()
  const r27 = await (await fetch(t.context.http + '/cms/users/luigui/')).json()
  const r28 = await (
    await fetch(t.context.http + '/panel/users/luigui/')
  ).json()
  const r29 = await (await fetch(t.context.http + '/a:b')).json()
  const r30 = await (await fetch(t.context.http + '/a:b/panel')).json()
  const r31 = await (await fetch(t.context.http + '/based:secret')).json()

  await server.destroy()

  t.deepEqual(r1, { result: true, path: '/', functionName: 'root' })
  t.deepEqual(r2, { result: true, path: '/', functionName: 'root' })
  t.deepEqual(r3, { result: true, path: '/', functionName: 'root' })
  t.deepEqual(r4, { result: true, path: '/', functionName: 'root' })
  t.deepEqual(r5, { result: true, path: '/', functionName: 'root' })
  t.deepEqual(r6, { result: true, path: '/', functionName: 'root' })
  t.deepEqual(r7, { result: true, path: '/', functionName: 'root' })
  t.deepEqual(r8, { result: true, path: '/', functionName: 'root' })
  t.deepEqual(r9, { result: true, path: '/voting', functionName: 'voting' })
  t.deepEqual(r10, { result: true, path: '/voting', functionName: 'voting' })
  t.deepEqual(r11, { result: true, path: '/', functionName: 'root' })
  t.deepEqual(r12, { result: true, path: '/', functionName: 'root' })
  t.deepEqual(r13, { result: true, path: '/', functionName: 'root' })
  t.deepEqual(r14, {
    result: true,
    path: '/artists/:name',
    functionName: 'artists',
  })
  t.deepEqual(r15, {
    result: true,
    path: '/artists/:name',
    functionName: 'artists',
  })
  t.deepEqual(r16, { result: true, path: '/', functionName: 'root' })
  t.deepEqual(r17, { result: true, path: '/', functionName: 'root' })
  t.deepEqual(r18, { result: true, path: '/', functionName: 'root' })
  t.deepEqual(r19, { result: true, path: '/', functionName: 'root' })
  t.deepEqual(r20, {
    result: true,
    path: '/musics/:name+',
    functionName: 'musics',
  })
  t.deepEqual(r21, {
    result: true,
    path: '/musics/:name+',
    functionName: 'musics',
  })
  t.deepEqual(r22, {
    result: true,
    path: '/musics/:name+',
    functionName: 'musics',
  })
  t.deepEqual(r23, { result: true, path: '/cms/:path*', functionName: 'cms' })
  t.deepEqual(r24, { result: true, path: '/cms/:path*', functionName: 'cms' })
  t.deepEqual(r25, { result: true, path: '/cms/:path*', functionName: 'cms' })
  t.deepEqual(r26, { result: true, path: '/cms/:path*', functionName: 'cms' })
  t.deepEqual(r27, { result: true, path: '/cms/:path*', functionName: 'cms' })
  t.deepEqual(r28, { result: true, path: '/panel/:path*', functionName: 'a:b' })
  t.deepEqual(r29, { result: true, path: '/', functionName: 'root' })
  t.deepEqual(r30, { result: true, path: '/', functionName: 'root' })
  t.true(r31)
  
})

test('[query] path matcher with static value and optional parameter', async (t: T) => {
  const server = new BasedServer({
    port: t.context.port,
    functions: {
      configs: makeQuery('/static/:parameter?', true),
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

  await server.destroy()

  t.true(r1)
  t.true(r2)
  t.true(r3)
  t.true(r4)
  t.true(r5)
  t.true(r6)
  t.true(r7)
  t.true(r8)
  t.true(r9)
  t.true(r10)
  t.true(r11)
  t.true(r12)
  t.true(r13)
  t.true(r14)
})

test('[query] path matcher with static value and required parameter', async (t: T) => {
  const server = new BasedServer({
    port: t.context.port,
    functions: {
      configs: makeQuery('/static/:parameter', true),
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
  const r5 = await (await fetch(t.context.http + '/static/123')).json()
  const r6 = await (await fetch(t.context.http + '/static/123/')).json()
  const r7 = await (await fetch(t.context.http + '/bla/static')).json()
  const r8 = await (await fetch(t.context.http + '/bla/static/')).json()
  const r9 = await (await fetch(t.context.http + '/bla/static/fafa')).json()
  const r10 = await (await fetch(t.context.http + '/bla/static/fafa/')).json()
  const r11 = await (await fetch(t.context.http + '/bla/static/123')).json()
  const r12 = await (
    await fetch(t.context.http + '/bla/static/123?token=123')
  ).json()
  const r13 = await (await fetch(t.context.http + '/bla/static/123/')).json()
  const r14 = await (
    await fetch(t.context.http + '/bla/static/123/?token=123')
  ).json()

  await server.destroy()

  t.is(
    JSON.stringify(r1),
    `{"error":"[static] Function not found.","code":40401}`,
  )
  t.is(
    JSON.stringify(r2),
    `{"error":"[static] Function not found.","code":40401}`,
  )
  t.true(r3)
  t.true(r4)
  t.true(r5)
  t.true(r6)
  t.is(JSON.stringify(r7), `{"error":"[bla] Function not found.","code":40401}`)
  t.is(JSON.stringify(r8), `{"error":"[bla] Function not found.","code":40401}`)
  t.true(r9)
  t.true(r10)
  t.true(r11)
  t.true(r12)
  t.true(r13)
  t.true(r14)
})

test('[query] path matcher with static value and multiple required parameters (1 or more)', async (t: T) => {
  const server = new BasedServer({
    port: t.context.port,
    functions: {
      configs: makeQuery('/static/:parameter+', true),
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

  await server.destroy()

  t.is(
    JSON.stringify(r1),
    `{"error":"[static] Function not found.","code":40401}`,
  )
  t.is(
    JSON.stringify(r2),
    `{"error":"[static] Function not found.","code":40401}`,
  )
  t.true(r3)
  t.true(r4)
  t.true(r5)
  t.true(r6)
  t.true(r7)
  t.true(r8)
  t.is(JSON.stringify(r9), `{"error":"[bla] Function not found.","code":40401}`)
  t.is(
    JSON.stringify(r10),
    `{"error":"[bla] Function not found.","code":40401}`,
  )
  t.true(r11)
  t.true(r12)
  t.true(r13)
  t.true(r14)
  t.true(r15)
  t.true(r16)
  t.true(r17)
})

test('[query] path matcher with static value and multiple optional parameters (0 or more)', async (t: T) => {
  const server = new BasedServer({
    port: t.context.port,
    functions: {
      configs: makeQuery('/static/:parameter*', true),
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

  await server.destroy()

  t.true(r1)
  t.true(r2)
  t.true(r3)
  t.true(r4)
  t.true(r5)
  t.true(r6)
  t.true(r7)
  t.true(r8)
  t.true(r9)
  t.true(r10)
  t.true(r11)
  t.true(r12)
  t.true(r13)
  t.true(r14)
  t.true(r15)
  t.true(r16)
  t.true(r17)
})

test('[query] path matcher with no static value and a optional parameter', async (t: T) => {
  const server = new BasedServer({
    port: t.context.port,
    functions: {
      configs: makeQuery('/:parameter?', true),
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
  const r7 = await (await fetch(t.context.http + '/fafa/fefe')).json()
  const r8 = await (await fetch(t.context.http + '/fafa/fefe/')).json()
  const r9 = await (await fetch(t.context.http + '/bla')).json()
  const r10 = await (await fetch(t.context.http + '/bla/')).json()
  const r11 = await (await fetch(t.context.http + '/bla/fafa')).json()
  const r12 = await (await fetch(t.context.http + '/bla/fafa/')).json()
  const r13 = await (await fetch(t.context.http + '/bla/123')).json()
  const r14 = await (await fetch(t.context.http + '/bla/123/')).json()
  const r15 = await (await fetch(t.context.http + '/bla/fafa/fefe')).json()
  const r16 = await (await fetch(t.context.http + '/bla/fafa/fefe/')).json()
  const r17 = await (await fetch(t.context.http + '/?token=123')).json()

  await server.destroy()

  t.true(r1)
  t.true(r2)
  t.true(r3)
  t.true(r5)
  t.true(r6)
  t.is(
    JSON.stringify(r7),
    `{"error":"[fafa] Function not found.","code":40401}`,
  )
  t.is(
    JSON.stringify(r8),
    `{"error":"[fafa] Function not found.","code":40401}`,
  )
  t.true(r9)
  t.true(r10)
  t.true(r11)
  t.true(r12)
  t.true(r13)
  t.true(r14)
  t.is(
    JSON.stringify(r15),
    `{"error":"[bla] Function not found.","code":40401}`,
  )
  t.is(
    JSON.stringify(r16),
    `{"error":"[bla] Function not found.","code":40401}`,
  )
  t.true(r17)
})

test('[function] path matcher with static value and optional parameter', async (t: T) => {
  const server = new BasedServer({
    port: t.context.port,
    functions: {
      configs: makeFunction('/static/:parameter?', true),
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
  const r15 = await (await fetch(t.context.http + '/bla/static/123/')).json()
  const r16 = await (
    await fetch(t.context.http + '/bla/static/123/?token=123')
  ).json()

  await server.destroy()

  t.true(r1.result)
  t.true(r2.result)
  t.true(r3.result)
  t.true(r4.result)
  t.true(r5.result)
  t.true(r6.result)
  t.true(r7.result)
  t.true(r8.result)
  t.true(r9.result)
  t.true(r10.result)
  t.true(r11.result)
  t.true(r12.result)
  t.true(r13.result)
  t.true(r14.result)
  t.true(r15.result)
  t.true(r16.result)
})

test('[function] path matcher with static value and required parameter', async (t: T) => {
  const server = new BasedServer({
    port: t.context.port,
    functions: {
      configs: makeFunction('/static/:parameter', true),
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
  const r5 = await (await fetch(t.context.http + '/static/123')).json()
  const r6 = await (await fetch(t.context.http + '/static/123/')).json()
  const r7 = await (await fetch(t.context.http + '/bla/static')).json()
  const r8 = await (await fetch(t.context.http + '/bla/static/')).json()
  const r9 = await (await fetch(t.context.http + '/bla/static/fafa')).json()
  const r10 = await (await fetch(t.context.http + '/bla/static/fafa/')).json()
  const r11 = await (await fetch(t.context.http + '/bla/static/123')).json()
  const r12 = await (
    await fetch(t.context.http + '/bla/static/123?token=123')
  ).json()
  const r13 = await (await fetch(t.context.http + '/bla/static/123/')).json()
  const r14 = await (
    await fetch(t.context.http + '/bla/static/123/?token=123')
  ).json()

  await server.destroy()

  t.is(
    JSON.stringify(r1),
    `{"error":"[static] Function not found.","code":40401}`,
  )
  t.is(
    JSON.stringify(r2),
    `{"error":"[static] Function not found.","code":40401}`,
  )
  t.true(r3.result)
  t.true(r4.result)
  t.true(r5.result)
  t.true(r6.result)
  t.is(JSON.stringify(r7), `{"error":"[bla] Function not found.","code":40401}`)
  t.is(JSON.stringify(r8), `{"error":"[bla] Function not found.","code":40401}`)
  t.true(r9.result)
  t.true(r10.result)
  t.true(r11.result)
  t.true(r12.result)
  t.true(r13.result)
  t.true(r14.result)
})

test('[function] path matcher with static value and multiple required parameters (1 or more)', async (t: T) => {
  const server = new BasedServer({
    port: t.context.port,
    functions: {
      configs: makeFunction('/static/:parameter+', true),
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

  await server.destroy()

  t.is(
    JSON.stringify(r1),
    `{"error":"[static] Function not found.","code":40401}`,
  )
  t.is(
    JSON.stringify(r2),
    `{"error":"[static] Function not found.","code":40401}`,
  )
  t.true(r3.result)
  t.true(r4.result)
  t.true(r5.result)
  t.true(r6.result)
  t.true(r7.result)
  t.true(r8.result)
  t.is(JSON.stringify(r9), `{"error":"[bla] Function not found.","code":40401}`)
  t.is(
    JSON.stringify(r10),
    `{"error":"[bla] Function not found.","code":40401}`,
  )
  t.true(r11.result)
  t.true(r12.result)
  t.true(r13.result)
  t.true(r14.result)
  t.true(r15.result)
  t.true(r16.result)
  t.true(r17.result)
})

test('[function] path matcher with static value and multiple optional parameters (0 or more)', async (t: T) => {
  const server = new BasedServer({
    port: t.context.port,
    functions: {
      configs: makeFunction('/static/:parameter*', true),
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

  await server.destroy()

  t.true(r1.result)
  t.true(r2.result)
  t.true(r3.result)
  t.true(r4.result)
  t.true(r5.result)
  t.true(r6.result)
  t.true(r7.result)
  t.true(r8.result)
  t.true(r9.result)
  t.true(r10.result)
  t.true(r11.result)
  t.true(r12.result)
  t.true(r13.result)
  t.true(r14.result)
  t.true(r15.result)
  t.true(r16.result)
  t.true(r17.result)
})

test('[function] path matcher with no static value and a optional parameter', async (t: T) => {
  const server = new BasedServer({
    port: t.context.port,
    functions: {
      configs: makeFunction('/:parameter?', true),
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
  const r7 = await (await fetch(t.context.http + '/fafa/fefe')).json()
  const r8 = await (await fetch(t.context.http + '/fafa/fefe/')).json()
  const r9 = await (await fetch(t.context.http + '/bla')).json()
  const r10 = await (await fetch(t.context.http + '/bla/')).json()
  const r11 = await (await fetch(t.context.http + '/bla/fafa')).json()
  const r12 = await (await fetch(t.context.http + '/bla/fafa/')).json()
  const r13 = await (await fetch(t.context.http + '/bla/123')).json()
  const r14 = await (await fetch(t.context.http + '/bla/123/')).json()
  const r15 = await (await fetch(t.context.http + '/bla/fafa/fefe')).json()
  const r16 = await (await fetch(t.context.http + '/bla/fafa/fefe/')).json()
  const r17 = await (await fetch(t.context.http + '/?token=123')).json()

  await server.destroy()

  t.true(r1.result)
  t.true(r2.result)
  t.true(r3.result)
  t.true(r5.result)
  t.true(r6.result)
  t.is(
    JSON.stringify(r7),
    `{"error":"[fafa] Function not found.","code":40401}`,
  )
  t.is(
    JSON.stringify(r8),
    `{"error":"[fafa] Function not found.","code":40401}`,
  )
  t.true(r9.result)
  t.true(r10.result)
  t.true(r11.result)
  t.true(r12.result)
  t.true(r13.result)
  t.true(r14.result)
  t.is(
    JSON.stringify(r15),
    `{"error":"[bla] Function not found.","code":40401}`,
  )
  t.is(
    JSON.stringify(r16),
    `{"error":"[bla] Function not found.","code":40401}`,
  )
  t.true(r17.result)
})
