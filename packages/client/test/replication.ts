import anyTest, { TestInterface } from 'ava'
import { BasedDbClient } from '../src'
import { startOrigin, startReplica } from '../../server/dist'
import { SelvaServer } from '../../server/dist/server'
import './assertions'
import getPort from 'get-port'
import { wait } from '@saulx/utils'

const test = anyTest as TestInterface<{
  origin: SelvaServer
  replica: SelvaServer
  originClient: BasedDbClient
  replicaClient: BasedDbClient
  originPort: number
  replicaPort: number
}>

test.beforeEach(async (t) => {
  const ip = '127.0.0.1'
  t.context.originPort = await getPort()
  t.context.replicaPort = await getPort()
  t.context.origin = await startOrigin({
    port: t.context.originPort,
    name: 'default',
  })
  t.context.replica = await startReplica({
    port: t.context.replicaPort,
    name: 'default',
  })

  console.log('connecting')
  const newClient = (port: number) => {
    const client = new BasedDbClient()
    client.connect({ port, host: ip })
    return client
  }
  t.context.originClient = newClient(t.context.originPort)
  t.context.replicaClient = newClient(t.context.replicaPort)

  console.log('start replication')
  await t.context.replicaClient.command('replicaof', [t.context.originPort, ip])
  console.log('wait for the replica')
  await t.context.originClient.command('replicawait')

  console.log('updating schema')
  await t.context.originClient.updateSchema({
    language: 'en',
    types: {
      ding: {
        prefix: 'di',
        fields: {
          name: { type: 'string' },
          dong: {
            type: 'references',
            bidirectional: { fromField: 'ding' },
          },
        },
      },
      dong: {
        prefix: 'do',
        fields: {
          name: { type: 'string' },
          value: {
            type: 'number',
          },
          ding: {
            type: 'reference',
            bidirectional: { fromField: 'dong' },
          },
        },
      },
    },
  })
})

test.afterEach.always(async (t) => {
  const destroy = async (srv: SelvaServer, client: BasedDbClient) => {
    if (srv?.destroy) {
      await srv.destroy()
    }
    if (client?.destroy) {
      client.destroy()
    }
  }

  await destroy(t.context.replica, t.context.replicaClient)
  await destroy(t.context.origin, t.context.originClient)
})

test('simple', async (t) => {
  const { originClient, replicaClient } = t.context

  t.deepEqual((await originClient.command('replicainfo'))[0][0], 'ORIGIN')
  t.deepEqual((await replicaClient.command('replicainfo'))[0][0], 'REPLICA_ACTIVE')

  const ding = await originClient.set({
    type: 'ding',
    name: 'ding 0',
  })
  const dong = await originClient.set({
    type: 'dong',
    name: 'dong 0',
    ding,
  })

  await wait(100)

  const oChildren = await originClient.command('hierarchy.children', ['root'])
  const rChildren = await replicaClient.command('hierarchy.children', ['root'])
  t.deepEqual(oChildren, rChildren)

  // TODO get doesn't work with replica?
  const oDong = await originClient.get({
    $id: dong,
    name: true,
    ding: true,
  })
  const rDong = await replicaClient.get({
    $id: dong,
    name: true,
    ding: true,
  })
  t.deepEqual(rDong, oDong)
})
