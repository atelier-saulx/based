import test, { ExecutionContext } from 'ava'
import { BasedServer } from '@based/server'
import fetch from 'cross-fetch'
import { wait } from '@saulx/utils'
import { encodeAuthState } from '../src/index.js'
import getPort from 'get-port'
// import { pathExtractor, pathMatcher, tokenizePattern } from '../../../server/dist/incoming/http/pathMatcher.js'

type T = ExecutionContext<{ port: number; ws: string; http: string }>

test.beforeEach(async (t: T) => {
  t.context.port = await getPort()
  t.context.ws = `ws://localhost:${t.context.port}`
  t.context.http = `http://localhost:${t.context.port}`
})

// test("extract values with one required parameter", (t: T) => {
//   const tokens = tokenizePattern(Buffer.from('/product/:description'))
//   const path = Buffer.from('/product/alou')

//   const parameters = pathExtractor(tokens, path)

//   console.log({parameters});
  

//   t.deepEqual(parameters, { 'file': 'something.jpg' })
// })

// test("match path with one optional parameter", (t: T) => {
//   const tokens = tokenizePattern(Buffer.from('/static/outro'))
//   const path = Buffer.from('/static/ou?tro/')

//   const match = pathMatcher(tokens, path)

//   console.log({match})

//   t.true(match)
// })

// test("match path with one static and one required parameter as a number", (t: T) => {
//   const tokens = tokenizePattern(Buffer.from('/static/:orderId'))
//   const path = Buffer.from('/static/123')

//   const parameters = pathExtractor(tokens, path)

//   t.deepEqual(parameters, { static: 'static', 'orderId': '123' })
// })

// console.log('true1', pathMatcher(Buffer.from('/o/:orderId'), Buffer.from('/o/123')))
    // console.log('false2', pathMatcher(Buffer.from('/o/:orderId'), Buffer.from('/o/')))
    // console.log('false3', pathMatcher(Buffer.from('/o/:orderId'), Buffer.from('/o/abc/abc')))
    // console.log('false4', pathMatcher(Buffer.from('/o/:orderId(\\d+)'), Buffer.from('/o/123')))
    // console.log('true5', pathMatcher(Buffer.from('/:orderId'), Buffer.from('/123')))
    // console.log('true6', pathMatcher(Buffer.from('/:orderId'), Buffer.from('/abc')))
    // console.log('true7', pathMatcher(Buffer.from('/:orderId'), Buffer.from('/abc/')))
    // console.log('false8', pathMatcher(Buffer.from('/:orderId'), Buffer.from('/abc/abc')))
    // console.log('true9', pathMatcher(Buffer.from('/path/:chapters+'), Buffer.from('/path/one/two/three')))
    // console.log('false10', pathMatcher(Buffer.from('/path/:chapters+'), Buffer.from('/path/')))
    // console.log('true11', pathMatcher(Buffer.from('/path/:chapters*'), Buffer.from('/path/one/two/three')))
    // console.log('true12', pathMatcher(Buffer.from('/path/:chapters*'), Buffer.from('/path/')))
    // console.log('true13', pathMatcher(Buffer.from('/users/:userId?'), Buffer.from('/users/123')))
    // console.log('true14', pathMatcher(Buffer.from('/users/:userId?'), Buffer.from('/users')))
    // console.log('false15', pathMatcher(Buffer.from('/users/:userId?'), Buffer.from('/users/abc/abc')))
    // console.log('true16', pathMatcher(Buffer.from('/users/:userId?'), Buffer.from('/users/abc')))
    // console.log('true17', pathMatcher(Buffer.from('/users'), Buffer.from('/users/')))
    // console.log('false18', pathMatcher(Buffer.from('/users'), Buffer.from('/users/abc')))

test('http path match', async (t: T) => {
  const server = new BasedServer({
    port: t.context.port,
    functions: {
      configs: {
        bla: {
          type: 'query',
          path: '/static/:parameter?',
          closeAfterIdleTime: 3e3,
          uninstallAfterIdleTime: 1e3,
          fn: (_, __, update) => {
            update(true)
            return () => {}
          },
        },
      },
    },
    auth: {
      authorize: async () => true,
    },
  })
  await server.start()

  const r1 = await (await fetch(t.context.http + '/static/fafa')).json()

  await server.destroy()

  t.true(r1)
})


// test("sandbox", (t: T) => {
//   const tokens = tokenizePattern(Buffer.from('/static/:orderId*'))
//   const path = Buffer.from('/static/value/value')
//   let result = false
//   let d = performance.now()
  
//   for (let i = 0; i < 10e6; i++) {
//     result = pathMatcher(tokens, path)
//   }
//   console.log(performance.now() - d, 'ms')

//   t.true(result)
// })