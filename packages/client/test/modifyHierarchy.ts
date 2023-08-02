import test from 'ava'
import { BasedDbClient, protocol } from '../src'
import { startOrigin } from '../../server/dist'
import { SelvaServer } from '../../server/dist/server'
import { wait } from '@saulx/utils'
import { readValue } from 'data-record'
import './assertions'
import { createRecord } from 'data-record'
import { SelvaMergeStrategy, SelvaTraversal } from '../src/protocol'
import { doubleDef } from '../src/protocol/encode/modify/types'

let srv: SelvaServer
let client: BasedDbClient
test.beforeEach(async (_t) => {
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
    languages: ['en', 'de', 'nl'],
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

test.afterEach(async (_t) => {
  await srv.destroy()
  client.destroy()
  await wait(300)
})

// TODO: parents: { $add } not working
test.serial.skip('complex hierarchy on one set', async (t) => {
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

  // t.deepEqualIgnoreOrder(
  //   await client.redis.selva_hierarchy_parents(
  //     '___selva_hierarchy',
  //     'maTest0001'
  //   ),
  //   ['root']
  // )
  // t.deepEqualIgnoreOrder(
  //   await client.redis.selva_hierarchy_parents(
  //     '___selva_hierarchy',
  //     'maTest0011'
  //   ),
  //   ['maTest0001', 'maTest0002']
  // )
  // t.deepEqualIgnoreOrder(
  //   await client.redis.selva_hierarchy_parents(
  //     '___selva_hierarchy',
  //     'maTest0012'
  //   ),
  //   ['maTest0001']
  // )
  // t.deepEqualIgnoreOrder(
  //   await client.redis.selva_hierarchy_parents(
  //     '___selva_hierarchy',
  //     'maTest0013'
  //   ),
  //   ['maTest0001']
  // )
  // t.deepEqualIgnoreOrder(
  //   await client.redis.selva_hierarchy_parents(
  //     '___selva_hierarchy',
  //     'maTest0021'
  //   ),
  //   ['maTest0011', 'maTest0013']
  // )
  //
  // t.deepEqualIgnoreOrder(
  //   await client.redis.selva_hierarchy_children(
  //     '___selva_hierarchy',
  //     'maTest0001'
  //   ),
  //   ['maTest0011', 'maTest0012', 'maTest0013']
  // )
  // t.deepEqualIgnoreOrder(
  //   await client.redis.selva_hierarchy_children(
  //     '___selva_hierarchy',
  //     'maTest0002'
  //   ),
  //   ['maTest0011']
  // )
  // t.deepEqualIgnoreOrder(
  //   await client.redis.selva_hierarchy_children(
  //     '___selva_hierarchy',
  //     'maTest0011'
  //   ),
  //   ['maTest0021']
  // )
  // t.deepEqualIgnoreOrder(
  //   await client.redis.selva_hierarchy_children(
  //     '___selva_hierarchy',
  //     'maTest0012'
  //   ),
  //   []
  // )
  // t.deepEqualIgnoreOrder(
  //   await client.redis.selva_hierarchy_children(
  //     '___selva_hierarchy',
  //     'maTest0013'
  //   ),
  //   ['maTest0021']
  // )
  // t.deepEqualIgnoreOrder(
  //   await client.redis.selva_hierarchy_children(
  //     '___selva_hierarchy',
  //     'maTest0021'
  //   ),
  //   ['maTest0031']
  // )
})

// TODO: waiting for creating node directly when setting children
test.serial.skip('complex hierarchy on two sets', async (t) => {
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

  t.deepEqualIgnoreOrder(
    // await client.redis.selva_hierarchy_parents(
    //   '___selva_hierarchy',
    //   'maTest0001'
    // ),
    (await client.command('hierarchy.parents', ['maTest0001']))[0],
    ['root']
  )
  // t.deepEqualIgnoreOrder(
  //   await client.redis.selva_hierarchy_parents(
  //     '___selva_hierarchy',
  //     'maTest0011'
  //   ),
  //   ['maTest0001', 'maTest0002']
  // )
  // t.deepEqualIgnoreOrder(
  //   await client.redis.selva_hierarchy_parents(
  //     '___selva_hierarchy',
  //     'maTest0012'
  //   ),
  //   ['maTest0001']
  // )
  // t.deepEqualIgnoreOrder(
  //   await client.redis.selva_hierarchy_parents(
  //     '___selva_hierarchy',
  //     'maTest0013'
  //   ),
  //   ['maTest0001']
  // )
  // t.deepEqualIgnoreOrder(
  //   await client.redis.selva_hierarchy_parents(
  //     '___selva_hierarchy',
  //     'maTest0021'
  //   ),
  //   ['maTest0011', 'maTest0013']
  // )
  //
  // t.deepEqualIgnoreOrder(
  //   await client.redis.selva_hierarchy_children(
  //     '___selva_hierarchy',
  //     'maTest0001'
  //   ),
  //   ['maTest0011', 'maTest0012', 'maTest0013']
  // )
  // t.deepEqualIgnoreOrder(
  //   await client.redis.selva_hierarchy_children(
  //     '___selva_hierarchy',
  //     'maTest0002'
  //   ),
  //   ['maTest0011']
  // )
  // t.deepEqualIgnoreOrder(
  //   await client.redis.selva_hierarchy_children(
  //     '___selva_hierarchy',
  //     'maTest0011'
  //   ),
  //   ['maTest0021']
  // )
  // t.deepEqualIgnoreOrder(
  //   await client.redis.selva_hierarchy_children(
  //     '___selva_hierarchy',
  //     'maTest0012'
  //   ),
  //   []
  // )
  // t.deepEqualIgnoreOrder(
  //   await client.redis.selva_hierarchy_children(
  //     '___selva_hierarchy',
  //     'maTest0013'
  //   ),
  //   ['maTest0021']
  // )
  // t.deepEqualIgnoreOrder(
  //   await client.redis.selva_hierarchy_children(
  //     '___selva_hierarchy',
  //     'maTest0021'
  //   ),
  //   ['maTest0031']
  // )
})

// TODO: waiting for creating node directly when setting children
test.serial.skip('complex hierarchy using add', async (t) => {
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

  t.deepEqualIgnoreOrder(
    // await client.redis.selva_hierarchy_parents(
    //   '___selva_hierarchy',
    //   'maTest0001'
    // ),
    (await client.command('hierarchy.parents', ['maTest0001']))[0],
    ['root']
  )
  // t.deepEqualIgnoreOrder(
  //   await client.redis.selva_hierarchy_parents(
  //     '___selva_hierarchy',
  //     'maTest0011'
  //   ),
  //   ['maTest0001', 'maTest0002']
  // )
  // t.deepEqualIgnoreOrder(
  //   await client.redis.selva_hierarchy_parents(
  //     '___selva_hierarchy',
  //     'maTest0012'
  //   ),
  //   ['maTest0001']
  // )
  // t.deepEqualIgnoreOrder(
  //   await client.redis.selva_hierarchy_parents(
  //     '___selva_hierarchy',
  //     'maTest0013'
  //   ),
  //   ['maTest0001']
  // )
  // t.deepEqualIgnoreOrder(
  //   await client.redis.selva_hierarchy_parents(
  //     '___selva_hierarchy',
  //     'maTest0021'
  //   ),
  //   ['maTest0011', 'maTest0013']
  // )
  //
  // t.deepEqualIgnoreOrder(
  //   await client.redis.selva_hierarchy_children(
  //     '___selva_hierarchy',
  //     'maTest0001'
  //   ),
  //   ['maTest0011', 'maTest0012', 'maTest0013']
  // )
  // t.deepEqualIgnoreOrder(
  //   await client.redis.selva_hierarchy_children(
  //     '___selva_hierarchy',
  //     'maTest0002'
  //   ),
  //   ['maTest0011']
  // )
  // t.deepEqualIgnoreOrder(
  //   await client.redis.selva_hierarchy_children(
  //     '___selva_hierarchy',
  //     'maTest0011'
  //   ),
  //   ['maTest0021']
  // )
  // t.deepEqualIgnoreOrder(
  //   await client.redis.selva_hierarchy_children(
  //     '___selva_hierarchy',
  //     'maTest0012'
  //   ),
  //   []
  // )
  // t.deepEqualIgnoreOrder(
  //   await client.redis.selva_hierarchy_children(
  //     '___selva_hierarchy',
  //     'maTest0013'
  //   ),
  //   ['maTest0021']
  // )
  // t.deepEqualIgnoreOrder(
  //   await client.redis.selva_hierarchy_children(
  //     '___selva_hierarchy',
  //     'maTest0021'
  //   ),
  //   ['maTest0031']
  // )
})

// TODO: waiting for creating node directly when setting children
test.serial.skip('Undo complex hierarchy using set', async (t) => {
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

  t.deepEqualIgnoreOrder(
    // await client.redis.selva_hierarchy_parents(
    //   '___selva_hierarchy',
    //   'maTest0021'
    // ),
    (await client.command('hierarchy.parents', ['maTest0021']))[0],
    ['maTest0011', 'maTest0013']
  )

  // await client.set({
  //   $id: 'maTest0021',
  //   parents: ['maTest0013'],
  // })
  //
  // t.deepEqualIgnoreOrder(
  //   await client.redis.selva_hierarchy_parents(
  //     '___selva_hierarchy',
  //     'maTest0021'
  //   ),
  //   ['maTest0013']
  // )
  // t.deepEqualIgnoreOrder(
  //   await client.redis.selva_hierarchy_children(
  //     '___selva_hierarchy',
  //     'maTest0011'
  //   ),
  //   []
  // )
  // t.deepEqualIgnoreOrder(
  //   await client.redis.selva_hierarchy_children(
  //     '___selva_hierarchy',
  //     'maTest0013'
  //   ),
  //   ['maTest0021']
  // )
})
