import { basicTest } from '../assertions/index.js'
import { subscribe } from '@based/db-subs'
import { wait } from '@saulx/utils'

const test = basicTest({
  language: 'en',
  types: {
    league: {
      prefix: 'le',
      fields: {
        name: { type: 'string' },
        thing: { type: 'string' },
        matches: { type: 'references' },
      },
    },
    match: {
      prefix: 'ma',
      fields: {
        name: { type: 'string' },
        description: { type: 'text' },
        value: {
          type: 'number',
        },
        status: { type: 'number' },
      },
    },
  },
})

test('subscription find by type', async (t) => {
  const client = t.context.client

  await client.set({
    $id: 'le1',
    type: 'league',
    name: 'league 1',
  })

  await client.set({
    $id: 'ma1',
    parents: ['le1'],
    type: 'match',
    name: 'match 1',
    value: 1,
  })

  await client.set({
    $id: 'ma2',
    parents: ['ma1'],
    type: 'match',
    name: 'match 2',
    value: 2,
  })

  await client.set({
    $id: 'ma3',
    parents: ['ma1'],
    type: 'match',
    name: 'match 3',
  })

  await client.set({
    $id: 'le1',
    matches: ['ma1', 'ma2', 'ma3'],
  })

  t.plan(3)

  let cnt1 = 0
  subscribe(
    client,
    {
      $id: 'root',
      id: true,
      items: {
        name: true,
        nonsense: { $default: 'yes' },
        $list: {
          $find: {
            $recursive: true,
            $traverse: {
              root: 'children',
              league: 'children',
              $any: false,
            },
            $filter: [
              {
                $field: 'type',
                $operator: '=',
                $value: 'match',
              },
              {
                $field: 'value',
                $operator: 'exists',
              },
            ],
          },
        },
      },
    },
    (v: any) => {
      if (cnt1 === 0) {
        t.deepEqual(v, {
          id: 'root',
          items: [
            { name: 'match 1', nonsense: 'yes' },
            // { name: 'match 2', nonsense: 'yes' },
          ],
        })
      } else {
        // t.fail()
      }
      cnt1++
    }
  )

  let cnt2 = 0
  subscribe(
    client,
    {
      $id: 'root',
      id: true,
      items: {
        name: true,
        nonsense: { $default: 'yes' },
        $list: {
          $find: {
            $recursive: true,
            $traverse: {
              root: 'children',
              league: { $first: ['matches', 'children'] },
              $any: false,
            },
            $filter: [
              {
                $field: 'type',
                $operator: '=',
                $value: 'match',
              },
              {
                $field: 'value',
                $operator: 'exists',
              },
            ],
          },
        },
      },
    },
    (v: any) => {
      if (cnt2 === 0) {
        t.deepEqual(v, {
          id: 'root',
          items: [
            { name: 'match 1', nonsense: 'yes' },
            { name: 'match 2', nonsense: 'yes' },
          ],
        })
      } else if (cnt2 === 1) {
        t.deepEqual(v, {
          id: 'root',
          items: [
            { name: 'match 1', nonsense: 'yes' },
            { name: 'match 2', nonsense: 'yes' },
            { name: 'match 4', nonsense: 'yes' },
          ],
        })
      } else {
        t.fail()
      }
      cnt2++
    }
  )

  await wait(2e3)

  await Promise.all([
    client.set({
      $id: 'ma4',
      parents: ['ma1'],
      type: 'match',
      name: 'match 4',
      value: 4,
    }),

    client.set({
      $id: 'le1',
      matches: { $add: 'ma4' },
    }),
  ])

  await wait(2e3)
})
