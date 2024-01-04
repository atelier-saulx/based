import anyTest, { TestFn } from 'ava'
import { BasedDbClient } from '../src'
import { startOrigin } from '../../server/dist'
import { SelvaServer } from '../../server/dist/server'
import './assertions'
import getPort from 'get-port'
import { deepEqualIgnoreOrder } from './assertions'

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
    translations: ['de', 'nl'],
    root: {
      fields: {
        value: { type: 'number' },
        nested: {
          type: 'object',
          properties: {
            fun: { type: 'string' },
          },
        },
      },
    },
    types: {
      match: {
        prefix: 'ma',
        fields: {
          title: { type: 'text' },
          value: { type: 'number' },
          description: { type: 'text' },
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

test('complex hierarchy on one set', async (t) => {
  const { client } = t.context
  await client.set({
    $id: 'maTest0001',
    title: { en: 'ma1' },
    children: [
      {
        $id: 'maTest0011', // child of the first level
        title: { en: 'ma11' },
        children: [
          {
            $id: 'maTest0021',
            title: { en: 'ma21' },
          },
        ],
        parents: {
          $add: [
            {
              $id: 'maTest0002', // Additional parent
              title: { en: 'ma02' },
            },
          ],
        },
      },
      {
        $id: 'maTest0012', // child of the first level
        title: { en: 'ma12' },
      },
      {
        $id: 'maTest0013', // child of the first level
        title: { en: 'ma13' },
        children: [
          {
            $id: 'maTest0021',
            title: { en: 'ma21' },
            children: [
              {
                $id: 'maTest0031',
                title: { en: 'ma31' },
              },
            ],
          },
        ],
      },
    ],
  })

  deepEqualIgnoreOrder(
    t,
    (await client.command('hierarchy.parents', ['maTest0001']))[0],
    ['root']
  )
  deepEqualIgnoreOrder(
    t,
    (await client.command('hierarchy.parents', ['maTest0011']))[0],
    ['maTest0001', 'maTest0002']
  )
  deepEqualIgnoreOrder(
    t,
    (await client.command('hierarchy.parents', ['maTest0012']))[0],
    ['maTest0001']
  )
  deepEqualIgnoreOrder(
    t,
    (await client.command('hierarchy.parents', ['maTest0013']))[0],
    ['maTest0001']
  )
  deepEqualIgnoreOrder(
    t,
    (await client.command('hierarchy.parents', ['maTest0021']))[0],
    ['maTest0011', 'maTest0013']
  )
  deepEqualIgnoreOrder(
    t,
    (await client.command('hierarchy.children', ['maTest0001']))[0],
    ['maTest0011', 'maTest0012', 'maTest0013']
  )
  deepEqualIgnoreOrder(
    t,
    (await client.command('hierarchy.children', ['maTest0002']))[0],
    ['maTest0011']
  )
  deepEqualIgnoreOrder(
    t,
    (await client.command('hierarchy.children', ['maTest0011']))[0],
    ['maTest0021']
  )
  deepEqualIgnoreOrder(
    t,
    (await client.command('hierarchy.children', ['maTest0012']))[0],
    []
  )
  deepEqualIgnoreOrder(
    t,
    (await client.command('hierarchy.children', ['maTest0013']))[0],
    ['maTest0021']
  )
  deepEqualIgnoreOrder(
    t,
    (await client.command('hierarchy.children', ['maTest0021']))[0],
    ['maTest0031']
  )
})

test('complex hierarchy on two sets', async (t) => {
  const { client } = t.context
  await client.set({
    $id: 'maTest0001',
    title: { en: 'ma1' },
    children: [
      {
        $id: 'maTest0011', // child of the first level
        title: { en: 'ma11' },
        parents: [
          {
            $id: 'maTest0002', // Additional parent
            title: { en: 'ma02' },
          },
        ],
      },
      {
        $id: 'maTest0012', // child of the first level
        title: { en: 'ma12' },
      },
      {
        $id: 'maTest0013', // child of the first level
        title: { en: 'ma13' },
      },
    ],
  })

  await client.set({
    $id: 'maTest0021',
    title: { en: 'ma21' },
    parents: ['maTest0013', 'maTest0011'],
    children: [
      {
        $id: 'maTest0031',
        title: { en: 'ma31' },
      },
    ],
  })

  deepEqualIgnoreOrder(
    t,
    (await client.command('hierarchy.parents', ['maTest0001']))[0],
    ['root']
  )
  deepEqualIgnoreOrder(
    t,
    (await client.command('hierarchy.parents', ['maTest0011']))[0],
    ['maTest0001', 'maTest0002']
  )
  deepEqualIgnoreOrder(
    t,
    (await client.command('hierarchy.parents', ['maTest0012']))[0],
    ['maTest0001']
  )
  deepEqualIgnoreOrder(
    t,
    (await client.command('hierarchy.parents', ['maTest0013']))[0],
    ['maTest0001']
  )
  deepEqualIgnoreOrder(
    t,
    (await client.command('hierarchy.parents', ['maTest0021']))[0],
    ['maTest0011', 'maTest0013']
  )
  deepEqualIgnoreOrder(
    t,
    (await client.command('hierarchy.children', ['maTest0001']))[0],
    ['maTest0011', 'maTest0012', 'maTest0013']
  )
  deepEqualIgnoreOrder(
    t,
    (await client.command('hierarchy.children', ['maTest0002']))[0],
    ['maTest0011']
  )
  deepEqualIgnoreOrder(
    t,
    (await client.command('hierarchy.children', ['maTest0011']))[0],
    ['maTest0021']
  )
  deepEqualIgnoreOrder(
    t,
    (await client.command('hierarchy.children', ['maTest0012']))[0],
    []
  )
  deepEqualIgnoreOrder(
    t,
    (await client.command('hierarchy.children', ['maTest0013']))[0],
    ['maTest0021']
  )
  deepEqualIgnoreOrder(
    t,
    (await client.command('hierarchy.children', ['maTest0021']))[0],
    ['maTest0031']
  )
})

test('complex hierarchy using add', async (t) => {
  const { client } = t.context
  await client.set({
    $id: 'maTest0001',
    title: { en: 'ma1' },
    children: [
      {
        $id: 'maTest0011', // child of the first level
        title: { en: 'ma11' },
        parents: [
          {
            $id: 'maTest0002', // Additional parent
            title: { en: 'ma02' },
          },
        ],
      },
      {
        $id: 'maTest0012', // child of the first level
        title: { en: 'ma12' },
      },
      {
        $id: 'maTest0013', // child of the first level
        title: { en: 'ma13' },
        children: [
          {
            $id: 'maTest0021',
            title: { en: 'ma21' },
            children: [
              {
                $id: 'maTest0031',
                title: { en: 'ma31' },
              },
            ],
          },
        ],
      },
    ],
  })

  await client.set({
    $id: 'maTest0021',
    parents: {
      $add: ['maTest0011'],
    },
  })

  deepEqualIgnoreOrder(
    t,
    (await client.command('hierarchy.parents', ['maTest0001']))[0],
    ['root']
  )
  deepEqualIgnoreOrder(
    t,
    (await client.command('hierarchy.parents', ['maTest0011']))[0],
    ['maTest0001', 'maTest0002']
  )
  deepEqualIgnoreOrder(
    t,
    (await client.command('hierarchy.parents', ['maTest0012']))[0],
    ['maTest0001']
  )
  deepEqualIgnoreOrder(
    t,
    (await client.command('hierarchy.parents', ['maTest0013']))[0],
    ['maTest0001']
  )
  deepEqualIgnoreOrder(
    t,
    (await client.command('hierarchy.parents', ['maTest0021']))[0],
    ['maTest0011', 'maTest0013']
  )
  deepEqualIgnoreOrder(
    t,
    (await client.command('hierarchy.children', ['maTest0001']))[0],
    ['maTest0011', 'maTest0012', 'maTest0013']
  )
  deepEqualIgnoreOrder(
    t,
    (await client.command('hierarchy.children', ['maTest0002']))[0],
    ['maTest0011']
  )
  deepEqualIgnoreOrder(
    t,
    (await client.command('hierarchy.children', ['maTest0011']))[0],
    ['maTest0021']
  )
  deepEqualIgnoreOrder(
    t,
    (await client.command('hierarchy.children', ['maTest0012']))[0],
    []
  )
  deepEqualIgnoreOrder(
    t,
    (await client.command('hierarchy.children', ['maTest0013']))[0],
    ['maTest0021']
  )
  deepEqualIgnoreOrder(
    t,
    (await client.command('hierarchy.children', ['maTest0021']))[0],
    ['maTest0031']
  )
})

test('Undo complex hierarchy using set', async (t) => {
  const { client } = t.context
  await client.set({
    $id: 'maTest0001',
    title: { en: 'ma1' },
    children: [
      {
        $id: 'maTest0011', // child of the first level
        title: { en: 'ma11' },
        parents: [
          {
            $id: 'maTest0002', // Additional parent
            title: { en: 'ma02' },
          },
        ],
      },
      {
        $id: 'maTest0012', // child of the first level
        title: { en: 'ma12' },
      },
      {
        $id: 'maTest0013', // child of the first level
        title: { en: 'ma13' },
        children: [
          {
            $id: 'maTest0021',
            title: { en: 'ma21' },
            children: [
              {
                $id: 'maTest0031',
                title: { en: 'ma31' },
              },
            ],
          },
        ],
      },
    ],
  })

  await client.set({
    $id: 'maTest0021',
    parents: {
      $add: ['maTest0011'],
    },
  })

  deepEqualIgnoreOrder(
    t,
    (await client.command('hierarchy.parents', ['maTest0021']))[0],
    ['maTest0011', 'maTest0013']
  )

  await client.set({
    $id: 'maTest0021',
    parents: ['maTest0013'],
  })

  deepEqualIgnoreOrder(
    t,
    (await client.command('hierarchy.parents', ['maTest0021']))[0],
    ['maTest0013']
  )

  deepEqualIgnoreOrder(
    t,
    (await client.command('hierarchy.children', ['maTest0011']))[0],
    []
  )

  deepEqualIgnoreOrder(
    t,
    (await client.command('hierarchy.children', ['maTest0013']))[0],
    ['maTest0021']
  )
})
