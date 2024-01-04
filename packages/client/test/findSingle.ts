import anyTest, { TestFn } from 'ava'
import { BasedDbClient } from '../src'
import { startOrigin } from '../../server/dist'
import { SelvaServer } from '../../server/dist/server'
import './assertions'
import getPort from 'get-port'

const test = anyTest as TestFn<{
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
    language: 'en',
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
          name: { type: 'string' },
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

test('find - single', async (t) => {
  const { client } = t.context
  // simple nested - single query
  const team = await client.set({
    $id: 'te0',
    type: 'team',
    name: 'team0',
  })
  const matches: any = []
  for (let i = 0; i < 11; i++) {
    matches.push({
      $id: await client.id({ type: 'match' }),
      type: 'match',
      name: 'match' + i,
      parents: [team],
    })
  }

  await Promise.all(matches.map((v: any) => client.set(v)))

  const r = await client.get({
    $id: 'te0',
    singleMatch: {
      name: true,
      nonsense: { $default: 'yes' },
      $find: {
        $traverse: 'children',
        $filter: [
          {
            $field: 'type',
            $operator: '=',
            $value: 'match',
          },
          {
            $field: 'name',
            $operator: '=',
            $value: 'match0',
          },
        ],
      },
    },
  })
  t.log(r)

  t.deepEqual(r, {
    singleMatch: {
      name: 'match0',
      nonsense: 'yes',
    },
  })
})

test('find - single with no wrapping', async (t) => {
  const { client } = t.context
  // simple nested - single query
  const team = await client.set({
    $id: 'te0',
    type: 'team',
    name: 'team0',
  })
  const matches: any = []
  for (let i = 0; i < 11; i++) {
    matches.push({
      $id: await client.id({ type: 'match' }),
      type: 'match',
      name: 'match' + i,
      parents: [team],
    })
  }

  await Promise.all(matches.map((v: any) => client.set(v)))

  const r = await client.get({
    $id: 'te0',
    name: true,
    $find: {
      $traverse: 'children',
      $filter: [
        {
          $field: 'type',
          $operator: '=',
          $value: 'match',
        },
        {
          $field: 'name',
          $operator: '=',
          $value: 'match0',
        },
      ],
    },
  })

  t.deepEqual(r, {
    name: 'match0',
  })
})

test('find - single in array', async (t) => {
  const { client } = t.context
  // simple nested - single query
  const team = await client.set({
    $id: 'te0',
    type: 'team',
    name: 'team0',
  })
  const matches: any = []
  for (let i = 0; i < 11; i++) {
    matches.push({
      $id: await client.id({ type: 'match' }),
      type: 'match',
      name: 'match' + i,
      parents: [team],
    })
  }

  await Promise.all(matches.map((v: any) => client.set(v)))

  const r = await client.get({
    $id: 'te0',
    results: [
      {
        id: { $field: 'id' },
      },
      {
        singleMatch: {
          name: true,
          $find: {
            $traverse: 'children',
            $filter: [
              {
                $field: 'type',
                $operator: '=',
                $value: 'match',
              },
              {
                $field: 'name',
                $operator: '=',
                $value: 'match0',
              },
            ],
          },
        },
      },
    ],
  })

  t.deepEqual(r, {
    results: [{ id: 'te0' }, { singleMatch: { name: 'match0' } }],
  })
})

test('find - single no wrapping in array', async (t) => {
  const { client } = t.context
  // simple nested - single query
  const team = await client.set({
    $id: 'te0',
    type: 'team',
    name: 'team0',
  })
  const matches: any = []
  for (let i = 0; i < 11; i++) {
    matches.push({
      $id: await client.id({ type: 'match' }),
      type: 'match',
      name: 'match' + i,
      parents: [team],
    })
  }

  await Promise.all(matches.map((v: any) => client.set(v)))

  const r = await client.get({
    $id: 'te0',
    results: [
      {
        name: true,
        $find: {
          $traverse: 'children',
          $filter: [
            {
              $field: 'type',
              $operator: '=',
              $value: 'match',
            },
            {
              $field: 'name',
              $operator: '=',
              $value: 'match0',
            },
          ],
        },
      },
    ],
  })

  t.deepEqual(r, {
    results: [{ name: 'match0' }],
  })
})
