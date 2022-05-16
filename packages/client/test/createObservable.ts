import test from 'ava'
import createServer from '@based/server'
import { wait } from '@saulx/utils'
import based from '../src'
import { start } from '@saulx/selva-server'

let db

const query = {
  things: {
    name: true,
    id: true,
    nested: true,
    $list: {
      $find: {
        $traverse: 'children',
        $filter: {
          $operator: '=',
          $value: 'thing',
          $field: 'type',
        },
      },
    },
  },
}

test.before(async () => {
  const selvaServer = await start({
    port: 9099,
    pipeRedisLogs: { stdout: false, stderr: false },
  })
  db = selvaServer.selvaClient
  await selvaServer.selvaClient.updateSchema({
    types: {
      thing: {
        fields: {
          name: { type: 'string' },
          nested: {
            type: 'object',
            properties: {
              something: { type: 'string' },
            },
          },
        },
      },
    },
  })
})

test.after(async () => {
  await db.destroy()
})

test.serial('createObservable', async (t) => {
  t.timeout(5000)
  const server = await createServer({
    port: 9100,
    db: {
      host: 'localhost',
      port: 9099,
    },
    config: {
      authorize: async () => true,
      functions: {
        rootInfo: {
          observable: true,
          shared: true,
          function: async ({ based, update }) => {
            return based.observe(
              {
                $id: 'root',
                $all: true,
              },
              update
            )
          },
        },
      },
    },
  })

  const client = based({
    url: async () => {
      return 'ws://localhost:9100'
    },
  })

  const r = []

  const obs = client.createObservable('rootInfo')

  const sub1 = obs.subscribe(
    (v) => {
      r.push(v)
    },
    (err) => {
      console.error(err)
    }
  )

  const obs2 = client.createObservable(query)

  const sub2 = obs2.subscribe(
    (v) => {
      r.push(v)
    },
    (err) => {
      console.error(err)
    }
  )

  await wait(1000)

  t.true(!!r.find((t) => t.things))

  t.true(!!r.find((t) => t.id === 'root'))

  sub1.unsubscribe()
  sub2.unsubscribe()

  await wait(1000)

  await server.destroy()

  client.disconnect()

  t.pass()

  // better nested error handling - share it
})
