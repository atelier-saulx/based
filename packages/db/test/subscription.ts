import { wait } from '@saulx/utils'
import { DbClient } from '../src/client/index.js'
import { DbServer } from '../src/server/index.js'
import test from './shared/test.js'
import { equal } from './shared/assert.js'
import { italy } from './shared/examples.js'
import { getDefaultHooks } from '../src/hooks.js'

const start = async (t, clientsN = 2) => {
  const server = new DbServer({
    path: t.tmp,
    onSchemaChange(schema) {
      for (const client of clients) {
        client.putLocalSchema(schema)
      }
    },
  })
  const clients = Array.from({ length: clientsN }).map(
    () =>
      new DbClient({
        hooks: getDefaultHooks(server, 100),
      }),
  )
  await server.start({ clean: true })
  t.after(() => server.destroy())
  return { clients, server }
}

await test('subscription', async (t) => {
  const clientsN = 2
  const { clients } = await start(t, clientsN)

  await clients[0].setSchema({
    types: {
      user: {
        derp: 'uint8',
        location: 'string',
        lang: 'string',
      },
    },
  })

  const x = await clients[0].create('user', {
    derp: 1,
  })

  let cnt = 0

  const close = clients[1]
    .query('user')
    .include('derp')
    .subscribe((q) => {
      cnt++
    })

  let setCnt = 0
  let interval = setInterval(async () => {
    await clients[0].update('user', x, {
      derp: { increment: 1 },
    })
    setCnt++
  }, 200)

  t.after((t) => {
    clearInterval(interval)
  })

  await wait(500)
  clearInterval(interval)
  close()

  equal(cnt - 1, setCnt, 'Incoming subs is equal to sets')

  await clients[1].create('user', {
    lang: 'de',
    location: 'hello',
  })

  const l = await clients[1].create('user', {
    lang: 'en',
    location: 'flap',
  })

  const close2 = clients[1]
    .query('user', l)
    .include('lang')
    .subscribe((q) => {
      cnt++
    })

  const langs = ['aa', 'bb', 'cc']

  setCnt = 0
  interval = setInterval(async () => {
    await clients[0].update('user', l, {
      lang: langs[setCnt % langs.length],
    })
    setCnt++
  }, 200)

  await wait(1000)
  equal(setCnt > 2, true, 'Incoming subs fired 1 ')

  clearInterval(interval)
  close2()

  setCnt = 0
  let lastSet = 'flap'
  interval = setInterval(async () => {
    lastSet = italy.slice(setCnt, setCnt + 4)
    await clients[0].update('user', l, {
      location: lastSet,
    })
    setCnt++
  }, 200)

  const close3 = clients[1]
    .query('user', l)
    .include('location')
    .subscribe((q) => {
      equal(lastSet, q.node(0).location, 'equals to last set')
      cnt++
    })

  await wait(1000)
  equal(setCnt > 3, true, 'Incoming subs fired 2')

  clearInterval(interval)
  close3()

  await wait(1000)
})
