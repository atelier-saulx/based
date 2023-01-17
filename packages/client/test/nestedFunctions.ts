import test from 'ava'
import { BasedClient } from '../src/index'
// make this methods on the server
import { createSimpleServer, callFunction, get, observe } from '@based/server'
import { wait } from '@saulx/utils'

test.serial('nested functions', async (t) => {
  const coreClient = new BasedClient()

  const server = await createSimpleServer({
    port: 9910,
    observables: {
      obsWithNestedLvl2: (payload, update) => {
        return observe(server, 'obsWithNested', {}, 'json', update, () => {})
      },
      obsWithNested: async (payload, update) => {
        return observe(
          server,
          payload === 'json' ? 'objectCounter' : 'counter',
          {},
          payload,
          update,
          () => {}
        )
      },
      objectCounter: async (payload, update) => {
        const largeThing: { bla: any[] } = { bla: [] }
        for (let i = 0; i < 1e4; i++) {
          largeThing.bla.push({
            title: 'snurp',
            cnt: i,
            snurp: ~~(Math.random() * 19999),
          })
        }
        update(largeThing)
        const counter = setInterval(() => {
          largeThing.bla[~~(Math.random() * largeThing.bla.length - 1)].snup =
            ~~(Math.random() * 19999)
          update(largeThing)
        }, 1)
        return () => {
          clearInterval(counter)
        }
      },
      counter: async (_payload, update) => {
        let cnt = 0
        update(cnt)
        const counter = setInterval(() => {
          update(++cnt)
        }, 1000)
        return () => {
          clearInterval(counter)
        }
      },
    },
    functions: {
      fnWithNested: async (payload, context) => {
        const x = await callFunction(server, 'hello', context, payload)
        await get(server, 'obsWithNested', context, 'json')
        return x
      },
      hello: async (payload) => {
        if (payload) {
          return payload
        }
        return 'flap'
      },
    },
  })

  coreClient.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })

  const x = await coreClient.call('fnWithNested', { bla: true })

  t.is(x, '{"bla":true}')

  let cnt = 0

  const closeX = coreClient.query('counter').subscribe(() => {
    cnt++
  })

  await wait(500)

  t.true(cnt > 0)

  closeX()

  let incomingCntNoJson = 0

  const close = coreClient.query('obsWithNested').subscribe(() => {
    incomingCntNoJson++
  })

  let incomingCnt = 0
  const close2 = coreClient.query('obsWithNested', 'json').subscribe(() => {
    incomingCnt++
  })

  await wait(1e3)

  const bla = await coreClient.query('obsWithNested', 'json').get()

  t.is(bla.bla.length, 1e4)

  await wait(1e3)

  let incomingCnt2 = 0
  close()
  close2()

  const close3 = coreClient
    .query('obsWithNestedLvl2', 'glurk')
    .subscribe(() => {
      incomingCnt2++
    })

  const bla2 = await coreClient.query('obsWithNestedLvl2', 'glakkel').get()

  t.is(bla2.bla.length, 1e4)

  await wait(1e3)

  close3()

  t.true(incomingCnt > 10)
  t.true(incomingCntNoJson > 0)
  t.true(incomingCnt2 > 10)

  await wait(15e3)

  t.is(server.activeObservablesById.size, 0)

  t.is(Object.keys(server.functions.specs).length, 0)
})
