import anyTest, { ExecutionContext, TestFn } from 'ava'
import { BasedDbClient } from '../src'
import { join as pathJoin } from 'path'
import { startOrigin, startReplica } from '../../server/dist'
import { SelvaServer } from '../../server/dist/server'
import './assertions'
import getPort from 'get-port'
import { wait } from '@saulx/utils'
import { removeDump } from './assertions/utils'

type Context = {
  origin: SelvaServer
  replica: SelvaServer
  originClient: BasedDbClient
  replicaClient: BasedDbClient
  originPort: number
  replicaPort: number
}
const test = anyTest as TestFn<Context>

const originDumpPath = pathJoin(process.cwd(), 'tmp', 'origin')
const replicaDumpPath = pathJoin(process.cwd(), 'tmp', 'replica')

function setupLogs(srv: SelvaServer, prefix: string) {
  const addPrefix = (s: string) =>
    s
      .split('\n')
      .map((s: string, i, a) => (i < a.length - 1 ? `${prefix}${s}` : s))
      .join('\n')

  if (srv.pm.stdout) {
    srv.pm.stdout.on('data', (data) => {
      console.log(addPrefix(`${data}`))
    })
  }
  if (srv.pm.stderr) {
    srv.pm.stderr.on('data', (data) => {
      console.error(addPrefix(`${data}`))
    })
  }
}

async function restartOrigin(t: ExecutionContext<Context>, clean?: boolean) {
  const port = t.context.originPort

  if (t.context.origin) {
    await t.context.origin.destroy()
  }

  if (clean) {
    removeDump(originDumpPath)
  }

  t.context.origin = await startOrigin({
    port,
    name: 'default',
    dir: originDumpPath,
  })

  // FIXME sometimes the client gets stuck after the server restarts, so we reconnect just in case
  if (t.context.originClient) {
    t.context.originClient.disconnect()
    t.context.originClient.connect({ port, host: '127.0.0.1' })
  }
}

async function restartReplica(t: ExecutionContext<Context>, clean?: boolean) {
  const port = t.context.replicaPort

  if (t.context.replica) {
    await t.context.replica.destroy()
  }

  if (clean) {
    removeDump(originDumpPath)
  }

  t.context.replica = await startReplica({
    port,
    name: 'default',
    dir: replicaDumpPath,
    stdio: 'pipe',
  })
  setupLogs(t.context.replica, 'replica:')

  // FIXME sometimes the client gets stuck after the server restarts, so we reconnect just in case
  if (t.context.replicaClient) {
    t.context.replicaClient.disconnect()
    t.context.replicaClient.connect({ port, host: '127.0.0.1' })
  }
}

async function wait_for_replication_state(
  replicaClient: BasedDbClient,
  expectedState: 'NONE' | 'ORIGIN' | 'REPLICA_STALE' | 'REPLICA_ACTIVE'
) {
  let replicaState = null

  for (let retries = 0; retries < 5; retries++) {
    replicaState = (await replicaClient.command('replicainfo'))[0][0]
    if (replicaState == expectedState) break
    console.log('check')
    await wait(300)
  }

  return replicaState
}

test.beforeEach(async (t) => {
  const ip = '127.0.0.1'

  removeDump(originDumpPath)
  removeDump(replicaDumpPath)

  t.context.originPort = await getPort()
  t.context.replicaPort = await getPort()
  await restartOrigin(t)
  await restartReplica(t)

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
  await t.context.originClient.command('replicawait', [])

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

  // FIXME Currently schema on replica doesn't work
  // - It's never read even for a new client
  // - It's not updated when it's replicated from the origin
  t.context.replicaClient.schema = t.context.originClient.schema
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

test.serial('simple replication', async (t) => {
  const { originClient, replicaClient } = t.context

  t.deepEqual((await originClient.command('replicainfo'))[0][0], 'ORIGIN')

  let replicaState = await wait_for_replication_state(
    replicaClient,
    'REPLICA_ACTIVE'
  )
  t.deepEqual(replicaState, 'REPLICA_ACTIVE')

  const ding = await originClient.set({
    type: 'ding',
    name: 'ding 0',
  })
  const dong = await originClient.set({
    type: 'dong',
    name: 'dong 0',
    ding,
  })

  await originClient.command('replicawait', [])

  const oChildren = await originClient.command('hierarchy.children', ['root'])
  const rChildren = await replicaClient.command('hierarchy.children', ['root'])
  t.deepEqual(oChildren, rChildren)

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

test.serial('replicate delete', async (t) => {
  const { originClient, replicaClient } = t.context

  const ding = await originClient.set({
    type: 'ding',
    name: 'ding 0',
  })
  originClient.delete({ $id: ding })
  await originClient.command('replicawait', [])
  t.deepEqual(await replicaClient.get({ $id: ding, id: true }), {})
})

test.serial('origin flush', async (t) => {
  const { originClient, replicaClient } = t.context

  const ding = await originClient.set({
    type: 'ding',
    name: 'ding 0',
  })
  await originClient.command('flush')
  await originClient.command('replicawait', [])
  t.deepEqual(await replicaClient.get({ $id: ding, id: true }), {})
})

test.serial.skip('origin load another sdb', async (_t) => {
  // const { originClient, replicaClient } = t.context
  // TODO
})

test.serial('replica restart', async (t) => {
  const { replicaClient } = t.context

  await restartReplica(t)
  // FIXME sometimes the client gets stuck here and this command is never executed
  // TODO We could also test the case where the restart is practically delayed by delaying this function call
  await t.context.replicaClient.command('replicaof', [
    t.context.originPort,
    '127.0.0.1',
  ])
  await t.context.originClient.command('replicawait', [])

  let replicaState = await wait_for_replication_state(
    replicaClient,
    'REPLICA_ACTIVE'
  )
  t.deepEqual(replicaState, 'REPLICA_ACTIVE')
})

test.serial('origin restart', async (t) => {
  const { replicaClient } = t.context

  await restartOrigin(t)
  // FIXME sometimes the client gets stuck here and this command is never executed
  await t.context.originClient.command('replicawait', [])

  let replicaState = await wait_for_replication_state(
    replicaClient,
    'REPLICA_ACTIVE'
  )
  t.deepEqual(replicaState, 'REPLICA_ACTIVE')
})

test.serial('origin restart with a new db', async (t) => {
  const { originClient, replicaClient } = t.context

  // First we need to write something
  const ding = await originClient.set({
    type: 'ding',
    name: 'ding 0',
  })
  await t.context.originClient.command('replicawait', [])

  // Here we also delete the dump so that the origin will start with a fresh db
  await restartOrigin(t, true)
  // FIXME sometimes the client gets stuck here and this command is never executed
  await t.context.originClient.command('replicawait', [])

  let replicaState = await wait_for_replication_state(
    replicaClient,
    'REPLICA_ACTIVE'
  )
  t.deepEqual(replicaState, 'REPLICA_ACTIVE')
  t.deepEqual(await replicaClient.get({ $id: ding, id: true }), {})
})

test.serial.skip('replica mismatch', async (_t) => {
  // const { originClient, replicaClient } = t.context
  // TODO Replica should load an SDB that's different from origin's state
})

test.serial.skip('full replication buffer', async (_t) => {
  // TODO Fill the replication buffer and verify that everything stabilizes eventually
  // TODO This should be also tested with >1 replicas where one or more replicas are too slow to follow the origin
})
