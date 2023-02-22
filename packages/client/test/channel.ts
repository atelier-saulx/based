import test from 'ava'
import { createSimpleServer } from '@based/server'
import { BasedClient } from '../src'
import { wait } from '@saulx/utils'

test.serial('Subscribe channel', async (t) => {
  let closeCalled = false
  const server = await createSimpleServer({
    uninstallAfterIdleTime: 1e3,
    closeAfterIdleTime: {
      channel: 0,
      query: 0,
    },
    port: 9910,
    channels: {
      mychannel: (based, payload, id, update) => {
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
  })
  const client = new BasedClient()
  await client.connect({
    url: async () => 'ws://localhost:9910',
  })
  const numbers: any[] = []
  const closeChannel = client
    .channel('mychannel', { bla: true })
    .subscribe((msg) => {
      numbers.push(msg)
    })
  await wait(500)
  t.true(numbers.length > 2)
  await server.functions.update({
    channel: true,
    name: 'mychannel',
    checksum: 2,
    publish: () => {},
    function: (based, payload, id, update) => {
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

test.serial('Channel publish + subscribe', async (t) => {
  let closeCalled = false
  const listeners: Map<number, (msg: any) => void> = new Map()
  const server = await createSimpleServer({
    uninstallAfterIdleTime: 1e3,
    port: 9910,
    closeAfterIdleTime: {
      channel: 0,
      query: 0,
    },
    channels: {
      a: {
        publish: (based, payload, msg, id) => {
          listeners.get(id)?.(msg)
        },
        function: (based, payload, id, update) => {
          listeners.set(id, update)
          return () => {
            closeCalled = true
          }
        },
      },
    },
  })
  const client = new BasedClient()
  await client.connect({
    url: async () => 'ws://localhost:9910',
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

test.serial('Channel publish no subscribe', async (t) => {
  const r: any[] = []
  const server = await createSimpleServer({
    uninstallAfterIdleTime: 1e3,
    port: 9910,
    channels: {
      a: {
        rateLimitTokens: 0,
        closeAfterIdleTime: 10,
        publish: (based, payload, msg) => {
          r.push(msg)
        },
        function: () => {
          return () => {}
        },
      },
    },
  })
  const client = new BasedClient()
  client.channelCleanupCycle = 100
  await client.connect({
    url: async () => 'ws://localhost:9910',
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

test.serial('Channel publish requestId (10k messages)', async (t) => {
  const r: any[] = []
  const server = await createSimpleServer({
    uninstallAfterIdleTime: 1e3,
    port: 9910,
    ws: {
      maxBackpressureSize: 2e6,
    },
    rateLimit: {
      ws: 1e6,
      http: 1e6,
      drain: 1e6,
    },
    channels: {
      a: {
        closeAfterIdleTime: 10,
        // based, payload, msg, ctx, id
        publish: (based, payload, msg) => {
          r.push(msg)
        },
        // add id as arg
        function: () => {
          return () => {}
        },
      },
    },
  })
  const client = new BasedClient()
  let rePublish = 0
  let registerChannelId = 0
  client.on('debug', (d) => {
    if (d.type === 'publishChannel') {
      return
    }
    if (d.type === 'registerChannelId') {
      registerChannelId++
    }
    if (d.type === 'rePublishChannel') {
      rePublish++
    }
  })
  client.channelCleanupCycle = 10e3
  await client.connect({
    url: async () => 'ws://localhost:9910',
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
  t.is(rePublish, 10000)
  t.is(registerChannelId, 2)
  t.deepEqual(r, [1, 2, 3, 4, ...results])
  t.is(Object.keys(server.activeChannels).length, 0)
  t.is(server.activeChannelsById.size, 0)
  client.disconnect()
  await server.destroy()
})

test.serial('Nested channel publish + subscribe', async (t) => {
  let closeCalled = false
  const listeners: Map<number, (msg: any) => void> = new Map()
  const server = await createSimpleServer({
    uninstallAfterIdleTime: 1e3,
    port: 9910,
    closeAfterIdleTime: {
      channel: 0,
      query: 0,
    },
    functions: {
      helloPublish: async (based) => {
        based.channel('a').publish('from helloPublish')
        return 'hello!'
      },
    },
    channels: {
      a: {
        publish: (based, payload, msg, id) => {
          listeners.get(id)?.(msg)
        },
        function: (based, payload, id, update) => {
          listeners.set(id, update)
          return () => {
            closeCalled = true
          }
        },
      },
      b: {
        publish: () => {},
        function: (based, payload, id, update) => {
          return based.channel('a', payload).subscribe((msg) => {
            update(msg)
          })
        },
      },
    },
  })
  const client = new BasedClient()
  await client.connect({
    url: async () => 'ws://localhost:9910',
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

test.serial.only('Channel publish + subscribe errors', async (t) => {
  const listeners: Map<number, (msg: any) => void> = new Map()
  const server = await createSimpleServer({
    uninstallAfterIdleTime: 1e3,
    port: 9910,
    closeAfterIdleTime: {
      channel: 0,
      query: 0,
    },
    auth: {
      authorize: async (based, ctx, name) => {
        if (name === 'a') {
          return false
        }
        return true
      },
    },
    functions: {
      helloPublish: async (based) => {
        based.channel('gurd').publish('from helloPublish')
        return 'hello!'
      },
      yes: async (based) => {
        based.channel('b').publish('from helloPublish')
        return 'hello!'
      },
    },
    channels: {
      x: {
        publish: () => {
          throw new Error('publish wrong')
        },
        function: () => {
          throw new Error('bla')
        },
      },
      a: {
        publish: (based, payload, msg, id) => {
          listeners.get(id)?.(msg)
        },
        function: (based, payload, id, update) => {
          listeners.set(id, update)
          return () => {}
        },
      },
      b: {
        publish: () => {
          throw new Error('publish wrong')
        },
        function: () => {
          throw new Error('bla')
        },
      },
    },
  })
  const client = new BasedClient()
  await client.connect({
    url: async () => 'ws://localhost:9910',
  })
  // client.on('debug', (err) => {
  // console.info(err)
  // })
  const r: any[] = []
  const close1 = client.channel('a').subscribe(
    () => {},
    (err) => {
      r.push(err)
    }
  )
  const close2 = client.channel('b').subscribe(
    () => {},
    (err) => {
      r.push(err)
    }
  )
  client.channel('b').publish('hello')
  try {
    await client.call('helloPublish')
    t.fail('helloPublish should throw')
  } catch (err) {
    t.true(err.message.includes('[gurd] Function not found'))
  }
  await client.call('yes')
  await wait(200)
  t.is(r.length, 3)
  t.is(r[0].code, 40301)
  close1()
  close2()
  await wait(1500)
  t.is(Object.keys(server.activeChannels).length, 0)
  t.is(server.activeChannelsById.size, 0)
  client.disconnect()
  await server.destroy()
})
