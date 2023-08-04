import test from 'ava'
import { BasedDbClient } from '../src'
import { startOrigin } from '../../server/dist'
import { SelvaServer } from '../../server/dist/server'
import { wait } from '@saulx/utils'
import './assertions'

let srv: SelvaServer
let client: BasedDbClient
const port = 8081
test.beforeEach(async (t) => {
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
      league: {
        prefix: 'le',
        fields: {
          name: { type: 'string' },
          title: { type: 'text' },
          description: { type: 'text' },
        },
      },
      sport: {
        prefix: 'sp',
        fields: {
          title: { type: 'text' },
          name: { type: 'string' },
        },
      },
      club: {
        prefix: 'cl',
        fields: {
          name: { type: 'string' },
        },
      },
      team: {
        prefix: 'te',
        fields: {
          title: { type: 'text' },
          name: { type: 'string' },
        },
      },
      match: {
        prefix: 'ma',
        fields: {
          name: { type: 'string' },
          title: { type: 'text' },
          end: { type: 'number' },
          start: { type: 'number' },
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

// TODO: $inherit
test.serial.skip('layout query', async (t) => {
  // add theme and ads

  await client.set({
    $id: 'league1',
    $language: 'en',
    title: '🌊 mr flurpels 🌊',
    description: 'I like fancy 🌊',
    children: [
      {
        type: 'team',
        name: 'team!',
        title: '🌊 TEAM 🌊',
        children: [
          {
            type: 'match',
            name: 'match time',
            title: '🌊 MATCH 🌊',
            start: Date.now() - 10000,
            end: Date.now() + 60 * 60 * 1000 * 2,
          },
        ],
      },
    ],
  })

  await client.set({
    $id: 'spfootball',
    $language: 'en',
    title: 'flurp football',
    children: ['league1'],
  })

  const result = await client.get({
    $id: 'league1',
    id: true,
    $language: 'en',
    // theme: { $inherit: true },
    // ads: { $inherit: true },
    components: [
      {
        component: { $value: 'description' },
        title: {
          $field: 'title',
        },
        description: {
          $field: 'description',
        },
      },
      {
        component: { $value: 'gridLarge' },
        showall: { $value: true },
        children: {
          title: true,
          $list: {
            $limit: 100,
            $find: {
              $traverse: 'descendants',
              $filter: [
                {
                  $field: 'type',
                  $operator: '=',
                  $value: 'team',
                },
              ],
            },
          },
        },
      },
      {
        component: { $value: 'list' },
        children: {
          title: true,
          image: { icon: true, thumb: true },
          sport: { title: true, $inherit: { $item: 'sport' } },
          $list: {
            $sort: { $field: 'start', $order: 'asc' },
            $find: {
              $traverse: 'descendants',
              $filter: [
                {
                  $field: 'type',
                  $operator: '=',
                  $value: 'match',
                },
                {
                  $field: 'start',
                  $operator: '<',
                  $value: 'now',
                },
                {
                  $field: 'end',
                  $operator: '>',
                  $value: 'now',
                },
              ],
            },
          },
        },
      },
    ],
  })

  console.dir(result, { depth: 8 })

  t.deepEqualIgnoreOrder(result, {
    id: 'league1',
    components: [
      {
        component: 'description',
        title: '🌊 mr flurpels 🌊',
        description: 'I like fancy 🌊',
      },
      {
        component: 'gridLarge',
        showall: true,
        children: [{ title: '🌊 TEAM 🌊' }],
      },
      {
        component: 'list',
        children: [
          { sport: { title: 'flurp football' }, title: '🌊 MATCH 🌊' },
        ],
      },
    ],
  })
})
