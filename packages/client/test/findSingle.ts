import test from 'ava'
import { BasedDbClient } from '../src'
import { startOrigin } from '../../server/dist'
import { SelvaServer } from '../../server/dist/server'
import { wait } from '@saulx/utils'
import './assertions'

let srv: SelvaServer
let client: BasedDbClient
test.beforeEach(async (t) => {
  console.log('origin')
  srv = await startOrigin({
    port: 8081,
    name: 'default',
  })

  console.log('connecting')
  client = new BasedDbClient()
  client.connect({
    port: 8081,
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
})

// TODO: single $find (without $list) not working
test.serial.skip('find - single', async (t) => {
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
    singleMatch: { name: 'match0', nonsense: 'yes' },
  })
})

// TODO: single $find (without $list) not working
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

// TODO: single $find (without $list) not working
test.serial.skip('find - single in array', async (t) => {
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
    results: [{ singleMatch: { name: 'match0' } }],
  })
})

// TODO: single $find (without $list) not working
test.serial.skip('find - single no wrapping in array', async (t) => {
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
