import anyTest, { TestInterface } from 'ava'
import { BasedDbClient } from '../src'
import { startOrigin } from '../../server/dist'
import { SelvaServer } from '../../server/dist/server'
import { wait } from '@saulx/utils'
import './assertions'
import getPort from 'get-port'

const test = anyTest as TestInterface<{
  srv: SelvaServer
  client: BasedDbClient
  port: number
}>

test.beforeEach(async (t) => {
  t.context.port = await getPort()
  console.log('origin')
  t.context.srv = await startOrigin({
    port: t.context.port,
    name: 'default',
  })

  console.log('connecting')
  t.context.client = new BasedDbClient()
  t.context.client.connect({
    port: t.context.port,
    host: '127.0.0.1',
  })

  console.log('updating schema')

  await t.context.client.updateSchema({
    languages: ['en'],
    types: {
      team: {
        prefix: 'te',
        fields: {
          name: { type: 'string' },
        },
      },
      match: {
        prefix: 'ma',
        fields: {
          title: { type: 'string' },
          value: { type: 'number' },
          homeTeam: { type: 'reference' },
        },
      },
    },
  })
})

test.afterEach.always(async (t) => {
  const { srv, client } = t.context
  await srv.destroy()
  client.destroy()
})

// TODO Not implemented
test.skip('sort by ref + name', async (t) => {
  const { client } = t.context

  await client.set({
    $id: 'te1',
    type: 'team',
    name: 'Good',
  })
  await client.set({
    $id: 'te2',
    type: 'team',
    name: 'Awesome',
  })
  await client.set({
    $id: 'te3',
    name: 'Best',
  })

  await client.set({
    $id: 'ma1',
    type: 'match',
    value: 1,
    title: 'value1',
    homeTeam: 'te1',
  })
  await client.set({
    $id: 'ma2',
    type: 'match',
    value: 2,
    title: 'value2',
    homeTeam: 'te1',
  })
  await client.set({
    $id: 'ma3',
    type: 'match',
    value: 5,
    title: 'value none',
    homeTeam: 'te2',
  })
  await client.set({
    $id: 'ma4',
    type: 'match',
    value: 4,
    title: 'value4',
    homeTeam: 'te3',
  })
  await client.set({
    $id: 'ma5',
    type: 'match',
    value: 5,
    title: 'value none',
  })

  //t.deepEqual(
  console.log(
    'löllö',
    JSON.stringify(await client.get({
      children: {
        value: true,
        id: true,
        homeTeam: true,
        $filter: [
          {
            $field: 'type',
            $operator: '=',
            $value: 'match',
          },
        ],
        $list: {
          $sort: {
            $field: 'homeTeam.name',
            $order: 'asc',
          },
        },
      },
    }), null, 2),
    { children: [{ value: 1 }, { value: 2 }, { value: 4 }, {}, {}] }
  )
})
