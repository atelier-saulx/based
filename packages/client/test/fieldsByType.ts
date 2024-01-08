import anyTest, { TestFn } from 'ava'
import { BasedDbClient } from '../src/index.js'
import { startOrigin, SelvaServer } from '@based/db-server'
import { deepCopy } from '@saulx/utils'
import './assertions/index.js'
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
})

test.afterEach.always(async (t) => {
  const { srv, client } = t.context
  await srv.destroy()
  client.destroy()
})

test('$fieldsByType simple', async (t) => {
  const { client } = t.context
  await client.updateSchema({
    language: 'en',
    types: {
      car: {
        prefix: 'ma',
        fields: {
          name: { type: 'text' },
        },
      },
      engine: {
        prefix: 'ng',
        fields: {
          power: { type: 'number' },
          displacement: { type: 'number' },
        },
      },
      tire: {
        prefix: 'tr',
        fields: {
          position: { type: 'string' },
        },
      },
    },
  })

  const car = await client.set({
    type: 'car',
    name: { en: 'Clown wagon' },
    children: [
      {
        type: 'engine',
        power: 25.0,
        displacement: 569.0,
      },
      {
        type: 'tire',
        $id: 'tr1', // This wouldn't be necessary if we could sort by two fields
        position: 'LF',
      },
      {
        type: 'tire',
        $id: 'tr2',
        position: 'RF',
      },
      {
        type: 'tire',
        $id: 'tr3',
        position: 'LR',
      },
      {
        type: 'tire',
        $id: 'tr4',
        position: 'RR',
      },
    ],
  })

  const res = await client.get({
    $id: car,
    name: true,
    parts: {
      $fieldsByType: {
        engine: { type: true, power: true },
        tire: { type: true, position: true },
      },
      $list: {
        $find: { $traverse: 'children' },
      },
    },
  })
  res.parts.sort((a: any, b: any) =>
    a.type === b.type
      ? a.position.localeCompare(b.position)
      : a.type.localeCompare(b.type)
  )
  t.deepEqual(res, {
    name: { en: 'Clown wagon' },
    parts: [
      { type: 'engine', power: 25 },
      { type: 'tire', position: 'LF' },
      { type: 'tire', position: 'LR' },
      { type: 'tire', position: 'RF' },
      { type: 'tire', position: 'RR' },
    ],
  })

  t.deepEqual(
    await client.get({
      $id: car,
      name: true,
      parts: {
        $fieldsByType: {
          engine: { type: true, power: true },
          tire: { type: true, position: true },
        },
        $list: {
          $sort: { $field: 'type', $order: 'asc' },
          $find: { $traverse: 'children' },
        },
      },
    }),
    {
      name: { en: 'Clown wagon' },
      parts: [
        { type: 'engine', power: 25 },
        { type: 'tire', position: 'LF' },
        { type: 'tire', position: 'RF' },
        { type: 'tire', position: 'LR' },
        { type: 'tire', position: 'RR' },
      ],
    }
  )
})

test('$fieldsByType huge', async (t) => {
  const { client } = t.context
  const types = [...Array(26).keys()]
    .map((v) => String.fromCharCode(v + 97))
    .map((v) => ({
      prefix: `a${v}`,
      fields: [...Array(50).keys()]
        .map((i) => [`${v}f${i}`, { type: 'string' }])
        .reduce(
          // @ts-ignore
          (prev, cur: ['string', any]) => ({ ...prev, [cur[0]]: cur[1] }),
          {}
        ),
    }))
    .reduce((prev, cur) => ({ ...prev, [cur.prefix]: cur }), {})

  await client.updateSchema({
    language: 'en',
    types: deepCopy(types),
  })

  await Promise.all(
    Object.keys(types).map((t) =>
      client.set({
        $id: `${t}1`,
        ...Object.keys(types[t].fields).reduce(
          (prev, cur) => ({ ...prev, [cur]: `hello ${t}` }),
          {}
        ),
      })
    )
  )

  const fieldsByType = Object.keys(types).reduce(
    (prev, cur) => ({
      ...prev,
      [cur]: {
        type: true,
        parents: true,
        [`${cur.substring(1)}f1`]: true,
      },
    }),
    {}
  )
  await t.notThrowsAsync(async () =>
    client.get({
      $id: 'root',
      items: {
        $fieldsByType: fieldsByType,
        $list: {
          $offset: 0,
          $limit: 15,
          $sort: {
            $field: 'type',
            $order: 'desc',
          },
          $find: {
            $traverse: 'descendants',
          },
        },
      },
    })
  )
})
