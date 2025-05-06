import test, { ExecutionContext } from 'ava'
import { BasedServer } from '@based/server'
import { BasedClient } from '../src/index.js'
import { wait } from '@saulx/utils'
import fetch from 'cross-fetch'
import getPort from 'get-port'

type T = ExecutionContext<{ port: number; ws: string; http: string }>

test.beforeEach(async (t: T) => {
  t.context.port = await getPort()
  t.context.ws = `ws://localhost:${t.context.port}`
  t.context.http = `http://localhost:${t.context.port}`
})

test.serial('Subscribe channel', async (t: T) => {
  let closeCalled = false
  const server = new BasedServer({
    silent: true,
    port: t.context.port,
    functions: {
      closeAfterIdleTime: {
        channel: 0,
        query: 0,
      },
      configs: {
        mychannel: {
          type: 'channel',
          uninstallAfterIdleTime: 1e3,
          subscriber: (_, __, ___, update) => {
            let cnt = 0
            const interval = setInterval(() => {
              update(++cnt)
            }, 100)
            return () => {
              closeCalled = true
              clearInterval(interval)
            }
          },
        },
      },
    },
  })
  await server.start()
  const client = new BasedClient()
  await client.connect({
    url: async () => t.context.ws,
  })
  const numbers: any[] = []
  const closeChannel = client
    .channel('mychannel', { bla: true })
    .subscribe((msg) => {
      numbers.push(msg)
    })
  await wait(500)
  t.true(numbers.length > 2)
  // await server.functions.updateInternal({
  server.functions.updateInternal({
    type: 'channel',
    name: 'mychannel',
    version: 2,
    maxPayloadSize: 1e9,
    rateLimitTokens: 1,
    publisher: () => {},
    subscriber: (_, __, ___, update) => {
      let cnt = 0
      const interval = setInterval(() => {
        update('YES ' + ++cnt)
      }, 100)
      return () => {
        closeCalled = true
        clearInterval(interval)
      }
    },
  })
  await wait(500)
  t.true(numbers.length > 5)
  t.true(numbers[numbers.length - 1].startsWith('YES'))
  closeChannel()
  await wait(4e3)
  t.is(Object.keys(server.activeChannels).length, 0)
  t.is(server.activeChannelsById.size, 0)
  t.true(closeCalled)
  client.disconnect()
  await server.destroy()
})

test.serial('Channel publish + subscribe', async (t: T) => {
  let closeCalled = false
  const listeners: Map<number, (msg: any) => void> = new Map()
  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    functions: {
      closeAfterIdleTime: {
        channel: 0,
        query: 0,
      },
      configs: {
        a: {
          type: 'channel',
          uninstallAfterIdleTime: 1e3,
          publisher: (_, __, msg, id) => {
            listeners.get(id)?.(msg)
          },
          subscriber: (_, __, id, update) => {
            listeners.set(id, update)
            return () => {
              closeCalled = true
            }
          },
        },
      },
    },
  })
  await server.start()
  const client = new BasedClient()
  await client.connect({
    url: async () => t.context.ws,
  })
  const r: any[] = []
  const closeChannel = client.channel('a', { bla: true }).subscribe((msg) => {
    r.push(msg)
  })
  await wait(100)
  client.channel('a', { bla: true }).publish(1)
  client.channel('a', { bla: true }).publish(2)
  client.channel('a', { bla: true }).publish(3)
  await wait(500)
  t.deepEqual(r, [1, 2, 3])
  closeChannel()
  await wait(1500)
  t.is(Object.keys(server.activeChannels).length, 0)
  t.is(server.activeChannelsById.size, 0)
  t.true(closeCalled)
  client.disconnect()
  await server.destroy()
})

test.serial('Channel publish no subscribe', async (t: T) => {
  const r: any[] = []
  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    functions: {
      closeAfterIdleTime: {
        channel: 0,
        query: 0,
      },
      configs: {
        a: {
          type: 'channel',
          rateLimitTokens: 0,
          closeAfterIdleTime: 10,
          uninstallAfterIdleTime: 1e3,
          publisher: (_, __, msg) => {
            r.push(msg)
          },
          subscriber: () => {
            return () => {}
          },
        },
      },
    },
  })
  await server.start()
  const client = new BasedClient()
  client.channelCleanupCycle = 100
  await client.connect({
    url: async () => t.context.ws,
  })
  client.channel('a', { bla: true }).publish(1)
  client.channel('a', { bla: true }).publish(2)
  client.channel('a', { bla: true }).publish(3)
  await wait(100)
  client.channel('a', { bla: true }).publish(4)
  await wait(500)
  t.deepEqual(r, [1, 2, 3, 4])
  t.is(client.channelState.size, 0)
  await wait(1500)
  t.is(Object.keys(server.activeChannels).length, 0)
  t.is(server.activeChannelsById.size, 0)
  client.disconnect()
  await server.destroy()
})

test.serial('Channel publish requestId (10k messages)', async (t: T) => {
  const r: any[] = []
  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    ws: {
      maxBackpressureSize: 2e6,
    },
    rateLimit: {
      ws: 1e6,
      http: 1e6,
      drain: 1e6,
    },
    functions: {
      closeAfterIdleTime: {
        channel: 0,
        query: 0,
      },
      configs: {
        a: {
          type: 'channel',
          closeAfterIdleTime: 10,
          uninstallAfterIdleTime: 1e3,
          // based, payload, msg, ctx, id
          publisher: (_, __, msg) => {
            r.push(msg)
          },
          // add id as arg
          subscriber: () => {
            return () => {}
          },
        },
      },
    },
  })
  await server.start()
  const client = new BasedClient()
  client.maxPublishQueue = 1e9
  client.channelCleanupCycle = 10e3
  await client.connect({
    url: async () => t.context.ws,
  })
  client.channel('a', { bla: true }).publish(1)
  client.channel('a', { bla: true }).publish(2)
  client.channel('a', { bla: true }).publish(3)
  await wait(100)
  client.channel('a', { bla: true }).publish(4)
  await wait(500)
  t.deepEqual(r, [1, 2, 3, 4])
  await wait(1000)
  const results: string[] = []
  for (let i = 0; i < 10000; i++) {
    const x = `no id ${i} hello gone! 🙏`
    results.push(x)
    client.channel('a', { bla: true }).publish(x)
  }
  await wait(1500)
  t.deepEqual(r, [1, 2, 3, 4, ...results])
  t.is(Object.keys(server.activeChannels).length, 0)
  t.is(server.activeChannelsById.size, 0)
  client.disconnect()
  await server.destroy()
})

test.serial('Nested channel publish + subscribe', async (t: T) => {
  let closeCalled = false
  const listeners: Map<number, (msg: any) => void> = new Map()
  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    ws: {
      maxBackpressureSize: 2e6,
    },
    rateLimit: {
      ws: 1e6,
      http: 1e6,
      drain: 1e6,
    },
    functions: {
      closeAfterIdleTime: {
        channel: 0,
        query: 0,
      },
      configs: {
        helloPublish: {
          type: 'function',
          uninstallAfterIdleTime: 1e3,
          fn: async (based) => {
            based.channel('a').publish('from helloPublish')
            return 'hello!'
          },
        },
        a: {
          type: 'channel',
          uninstallAfterIdleTime: 1e3,
          publisher: (_, __, msg, id) => {
            listeners.get(id)?.(msg)
          },
          subscriber: (_, __, id, update) => {
            listeners.set(id, update)
            return () => {
              closeCalled = true
            }
          },
        },
        b: {
          type: 'channel',
          uninstallAfterIdleTime: 1e3,
          publisher: () => {},
          subscriber: (based, payload, _, update) => {
            return based.channel('a', payload).subscribe((msg) => {
              update(msg)
            })
          },
        },
      },
    },
  })
  await server.start()
  const client = new BasedClient()
  await client.connect({
    url: async () => t.context.ws,
  })
  const r: any[] = []
  const r2: any[] = []
  const closeChannel = client.channel('a').subscribe((msg) => {
    r.push(msg)
  })
  const closeChannel2 = client.channel('b').subscribe((msg) => {
    r2.push(msg)
  })
  await client.call('helloPublish')
  await wait(500)
  t.deepEqual(r, ['from helloPublish'])
  t.deepEqual(r2, r)
  closeChannel2()
  closeChannel()
  await wait(1500)
  t.is(Object.keys(server.activeChannels).length, 0)
  t.is(server.activeChannelsById.size, 0)
  t.true(closeCalled)
  client.disconnect()
  await server.destroy()
})

test.serial('Channel publish + subscribe errors', async (t: T) => {
  const listeners: Map<number, (msg: any) => void> = new Map()
  const aList: any[] = []
  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    auth: {
      authorize: async (_, __, name) => {
        if (name === 'a') {
          return false
        }
        return true
      },
    },
    functions: {
      closeAfterIdleTime: {
        channel: 0,
        query: 0,
      },
      configs: {
        helloPublish: {
          type: 'function',
          uninstallAfterIdleTime: 1e3,
          fn: async (based) => {
            based.channel('gurd').publish('from helloPublish')
            return 'hello!'
          },
        },
        yes: {
          type: 'function',
          uninstallAfterIdleTime: 1e3,
          fn: async (based) => {
            based.channel('b').publish('from helloPublish')
            return 'hello!'
          },
        },
        x: {
          type: 'channel',
          uninstallAfterIdleTime: 1e3,
          publisher: () => {
            throw new Error('publish wrong')
          },
          subscriber: () => {
            throw new Error('bla')
          },
        },
        a: {
          type: 'channel',
          uninstallAfterIdleTime: 1e3,
          publicPublisher: true,
          publisher: (_, __, msg, id) => {
            aList.push(msg)
            listeners.get(id)?.(msg)
          },
          subscriber: (_, __, id, update) => {
            listeners.set(id, update)
            return () => {}
          },
        },
        b: {
          type: 'channel',
          uninstallAfterIdleTime: 1e3,
          publisher: () => {
            throw new Error('publish wrong')
          },
          subscriber: () => {
            throw new Error('bla')
          },
        },
        c: {
          type: 'channel',
          uninstallAfterIdleTime: 1e3,
          publisher: (based, payload, msg) => {
            based.channel('b', payload).publish(msg)
          },
          subscriber: (based, payload, _, update, error) => {
            return based.channel('b', payload).subscribe(
              (msg) => {
                update(msg)
              },
              (err) => {
                error(err)
              },
            )
          },
        },
      },
    },
  })
  await server.start()
  const client = new BasedClient()
  await client.connect({
    url: async () => t.context.ws,
  })
  const r: any[] = []
  const close1 = client.channel('a').subscribe(
    () => {},
    (err) => {
      r.push(err)
    },
  )
  const close2 = client.channel('b').subscribe(
    () => {},
    (err) => {
      r.push(err)
    },
  )
  const close3 = client.channel('c', 1).subscribe(
    () => {},
    (err) => {
      r.push(err)
    },
  )
  client.channel('c', 1).publish('hello')
  client.channel('b').publish('hello')
  client.channel('a').publish('powerful')
  try {
    await client.call('helloPublish')
    t.fail('helloPublish should throw')
  } catch (err) {
    t.true(err.message.includes('[gurd] Function not found'))
  }
  await client.call('yes')
  await wait(200)
  t.is(aList[aList.length - 1], 'powerful')
  t.is(r.length, 4)
  t.is(r[0].code, 40301)
  close1()
  close2()
  close3()
  await wait(1500)
  t.is(Object.keys(server.activeChannels).length, 0)
  t.is(server.activeChannelsById.size, 0)
  client.disconnect()
  await server.destroy()
})

test.serial('Channel publish over rest', async (t: T) => {
  const r: any[] = []
  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    functions: {
      configs: {
        a: {
          type: 'channel',
          uninstallAfterIdleTime: 1e3,
          rateLimitTokens: 0,
          closeAfterIdleTime: 10,
          publisher: (_, payload, msg) => {
            r.push({ payload, msg })
          },
          subscriber: () => {
            return () => {}
          },
        },
      },
    },
  })
  await server.start()
  const client = new BasedClient()
  client.channelCleanupCycle = 100
  await client.connect({
    url: async () => t.context.ws,
  })

  await fetch(t.context.http + '/a?msg=bla&channelid=snurp')
  await fetch(t.context.http + '/a?msg=bla&type=pageView')
  await fetch(t.context.http + '/a?flapdrol=pageView')
  await fetch(t.context.http + '/a?gur')

  await fetch(t.context.http + '/a', {
    method: 'post',
    body: 'hello this is me!',
  })

  t.deepEqual(r, [
    { payload: 'snurp', msg: 'bla' },
    { payload: { type: 'pageView' }, msg: 'bla' },
    { payload: undefined, msg: { flapdrol: 'pageView' } },
    { payload: undefined, msg: { gur: true } },
    { payload: undefined, msg: 'hello this is me!' },
  ])

  t.is(client.channelState.size, 0)
  await wait(1500)
  t.is(Object.keys(server.activeChannels).length, 0)
  t.is(server.activeChannelsById.size, 0)
  client.disconnect()
  await server.destroy()
})

test.serial('Channel publish non existing channel', async (t: T) => {
  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    functions: {
      uninstallAfterIdleTime: 1e3,
      closeAfterIdleTime: { channel: 10, query: 10 },
    },
  })
  await server.start()
  const client = new BasedClient()
  await client.connect({
    url: async () => t.context.ws,
  })

  client.channel('c', 1).publish('hello')
  client.channel('b').publish('hello')
  client.channel('a').publish('powerful')

  await wait(1500)

  t.is(Object.keys(server.activeChannels).length, 0)
  t.is(server.activeChannelsById.size, 0)
  client.disconnect()
  await server.destroy()
})

test.serial(
  'Channel high load multi client subscribe and publish',
  async (t: T) => {
    const listeners: Map<number, (msg: any) => void> = new Map()

    const server = new BasedServer({
      port: t.context.port,
      silent: true,
      rateLimit: {
        ws: 1e9,
        drain: 1e3,
        http: 0,
      },
      functions: {
        closeAfterIdleTime: { channel: 10, query: 10 },
        configs: {
          a: {
            type: 'channel',
            uninstallAfterIdleTime: 1e3,
            publicPublisher: true,
            publisher: (_, __, msg, id) => {
              listeners.get(id)?.(msg)
            },
            subscriber: (_, __, id, update) => {
              listeners.set(id, update)
              return () => {}
            },
          },
        },
      },
    })
    await server.start()

    const incomingPerClient: Map<number, number> = new Map()

    const clients: BasedClient[] = []
    for (let i = 0; i < 10; i++) {
      const client = new BasedClient()
      client.connect({
        url: async () => t.context.ws,
      })
      const id = i
      client.channel('a').subscribe(() => {
        const incoming = incomingPerClient.get(id) || 0
        incomingPerClient.set(id, incoming + 1)
      })
      clients.push(client)
    }

    const publishClient = new BasedClient()
    await publishClient.connect({
      url: async () => t.context.ws,
    })

    publishClient.maxPublishQueue = 1e9

    const extraClient = new BasedClient()
    extraClient.connect({
      url: async () => t.context.ws,
    })

    for (let i = 0; i < 1e5; i++) {
      publishClient.channel('a').publish({ i })
    }

    await wait(1e3)

    let extra = 0
    extraClient.channel('a').subscribe(() => {
      extra++
    })
    publishClient.channel('a').publish({ i: 1000 })

    await wait(10e3)

    t.is(extra, 1)

    incomingPerClient.forEach((v) => {
      t.is(v, 1e5 + 1)
    })

    await Promise.all(clients.map((c) => c.destroy()))
    await publishClient.destroy()
    await extraClient.destroy()

    await wait(1500)

    t.is(Object.keys(server.activeChannels).length, 0)
    t.is(server.activeChannelsById.size, 0)
    await server.destroy()
  },
)
