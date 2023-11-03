import anyTest, { TestInterface } from 'ava'
import { deepCopy, wait } from '@saulx/utils'
import { TestCtx, observe, startSubs } from '../assertions'

const test = anyTest as TestInterface<TestCtx>

test.serial('get - correct order', async (t) => {
  await startSubs(t, {})
  const client = t.context.dbClient

  await client.updateSchema({
    language: 'en',
    translations: ['de', 'nl'],
    types: {
      folder: {
        prefix: 'fl',
        fields: {
          name: { type: 'string' },
          published: { type: 'boolean' },
          title: { type: 'text' },
        },
      },
      region: {
        prefix: 're',
        fields: {
          published: { type: 'boolean' },
          title: { type: 'text' },
        },
      },
      match: {
        prefix: 'ma',
        fields: {
          published: { type: 'boolean' },
          title: { type: 'text' },
        },
      },
    },
  })

  await client.set({
    $id: 'root',
    $language: 'en',
    children: [
      {
        type: 'folder',
        title: 'stuff',
        children: [
          {
            $id: 'ma1',
            title: 'match 1',
            published: true,
          },
          {
            $id: 'ma2',
            title: 'match 2',
            published: true,
          },
          {
            $id: 'ma3',
            title: 'match 3',
            published: true,
          },
          {
            $id: 'ma4',
            title: 'match 4',
            published: false,
          },
        ],
      },
      {
        type: 'region',
        $id: 're1',
        title: 'duitsland',
        published: true,
        children: [
          {
            type: 'folder',
            name: 'Highlights',
            published: true,
            children: ['ma1', 'ma2', 'ma3', 'ma4'],
          },
        ],
      },
    ],
  })

  const obs = {
    $id: 're1',
    children: {
      title: true,
      published: true,
      $list: {
        $find: {
          $traverse: 'children',
          $filter: [
            {
              $field: 'type',
              $operator: '=',
              $value: 'folder',
            },
            {
              $field: 'name',
              $operator: '=',
              $value: 'Highlights',
            },
          ],
          $find: {
            $traverse: 'children',
            $filter: [
              {
                $field: 'published',
                $operator: '=',
                $value: true,
              },
            ],
          },
        },
        $limit: 8,
      },
    },
  }

  const results: any[] = []

  observe(t, obs, (v) => {
    console.dir({ v }, { depth: 6 })
    results.push(deepCopy(v))
  })

  await wait(1e3)

  console.log('1', await client.command('subscriptions.list', []))
  await client.set({ $id: 'ma1', published: false })

  await wait(1e3)
  console.log('2', await client.command('subscriptions.list', []))

  await client.set({ $id: 'ma1', published: true })

  await wait(3e3)
  console.log('3', await client.command('subscriptions.list', []))

  console.dir({ results }, { depth: 6 })

  t.is(results.length, 3)
  t.is(results[0].children.length, 3)
  t.is(results[1].children.length, 2)
  t.is(results[2].children.length, 3)

  t.pass()
})
