import test from 'ava'
import { BasedDbClient } from '../src'
import { startOrigin } from '../../server/dist'
import { SelvaServer } from '../../server/dist/server'
import { wait } from '@saulx/utils'
import './assertions'
import getPort from 'get-port'

let srv: SelvaServer
let client: BasedDbClient
let port
test.beforeEach(async (t) => {
  port = await getPort()
  console.log('origin')
  srv = await startOrigin({
    port,
    name: 'default',
  })

  console.log('connecting')
  client = new BasedDbClient()
  client.connect({
    port,
    host: '127.0.0.1',
  })

  console.log('updating schema')

  await client.updateSchema({
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
          name: { type: 'string' },
        },
      },
    },
  })
})

test.afterEach(async (_t) => {
  await srv.destroy()
  client.destroy()
  await wait(300)
})

test.serial('find - single', async (t) => {
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

  await Promise.all(matches.map((v) => client.set(v)))

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

// TODO: single $find at top level should be supported?
test.serial.skip('find - single with no wrapping', async (t) => {
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

  await Promise.all(matches.map((v) => client.set(v)))

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

test.serial('find - single in array', async (t) => {
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

  await Promise.all(matches.map((v) => client.set(v)))

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

test.serial('find - single no wrapping in array', async (t) => {
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

  await Promise.all(matches.map((v) => client.set(v)))

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
