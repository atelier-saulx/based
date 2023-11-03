import anyTest, { TestInterface } from 'ava'
import { wait } from '@saulx/utils'
import { TestCtx, observe, startSubs } from '../assertions'
import { BasedSchemaPartial } from '@based/schema'

const test = anyTest as TestInterface<TestCtx>

const schema: BasedSchemaPartial = {
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
}

test.serial('subscription find by type', async (t) => {
  await startSubs(t, schema)
  const client = t.context.dbClient

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
  observe(
    t,
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
    (v) => {
      if (cnt1 === 0) {
        t.deepEqual(v, {
          id: 'root',
          items: [
            { name: 'match 1', nonsense: 'yes' },
            // { name: 'match 2', nonsense: 'yes' },
          ],
        })
      } else {
        t.fail()
      }
      cnt1++
    }
  )

  let cnt2 = 0
  observe(
    t,
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
    (v) => {
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

  console.log('-------- 1')
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
  console.log('-------- 2')

  await wait(2e3)
})
