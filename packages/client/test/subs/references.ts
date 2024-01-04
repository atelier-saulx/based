import { basicTest, deepEqualIgnoreOrder } from '../assertions'
import { subscribe } from '@based/db-subs'
import { deepCopy, wait } from '@saulx/utils'

const test = basicTest({
  language: 'en',
  types: {
    thing: {
      prefix: 'th',
      fields: {
        name: { type: 'string' },
        subthings: { type: 'references' },
      },
    },
    league: {
      prefix: 'le',
      fields: {
        name: { type: 'string' },
        matches: {
          type: 'references',
          bidirectional: { fromField: 'league' },
        },
      },
    },
    match: {
      prefix: 'ma',
      fields: {
        matchType: { type: 'string' },
        date: { type: 'number' },
        completedAt: { type: 'number' },
        league: {
          type: 'reference',
          bidirectional: { fromField: 'matches' },
        },
      },
    },
  },
})

test('add new reference', async (t) => {
  const client = t.context.client

  const league = await client.set({
    type: 'league',
    name: 'Best',
  })

  await client.set({
    $id: league,
    matches: {
      $add: [
        {
          $id: 'ma1',
          type: 'match',
          matchType: 'interesting',
          date: 1,
        },
      ],
    },
  })

  let res: any
  subscribe(
    client,
    {
      $id: league,
      ongoing: {
        id: true,
        $list: {
          $find: {
            $traverse: 'matches',
            $filter: {
              $field: 'matchType',
              $operator: '=',
              $value: 'interesting',
              $and: {
                $field: 'completedAt',
                $operator: 'notExists',
              },
            },
          },
        },
      },
    },
    (v: any) => {
      res = v
    }
  )

  await wait(200)
  await client.set({
    $id: league,
    matches: {
      $add: [
        {
          $id: 'ma2',
          type: 'match',
          matchType: 'interesting',
          date: 2,
        },
      ],
    },
  })
  await wait(200)
  await client.set({
    $id: league,
    matches: {
      $add: [
        {
          $id: 'ma3',
          date: 2,
          matchType: 'interesting',
          completedAt: 3,
        },
      ],
    },
  })
  await wait(200)
  await client.set({
    $id: 'ma3',
    completedAt: { $delete: true },
  })
  await wait(200)

  // const subs = await client.redis.selva_subscriptions_list('___selva_hierarchy')
  // console.log(subs)
  // console.log(await client.redis.selva_subscriptions_debug('___selva_hierarchy', subs[0]))
  // console.log('ma1', await client.command('subscriptions.debug', ['ma1']))
  // console.log('ma2', await client.command('subscriptions.debug', ['ma2']))
  // console.log('ma3', await client.command('subscriptions.debug', ['ma3']))

  t.deepEqual(res, { ongoing: [{ id: 'ma1' }, { id: 'ma2' }, { id: 'ma3' }] })

  await client.delete({ $id: 'ma2' })
  await wait(200)
  t.deepEqual(res, { ongoing: [{ id: 'ma1' }, { id: 'ma3' }] })
})

test('add new reference reverse', async (t) => {
  const client = t.context.client

  const league = await client.set({
    type: 'league',
    name: 'Best',
  })

  let res: any
  subscribe(
    client,
    {
      $id: league,
      id: true,
      matches: true,
    },
    (v: any) => {
      res = v
    }
  )

  await wait(200)
  const match = await client.set({
    type: 'match',
    league,
  })
  await wait(300)

  // console.log(await client.command('subscriptions.debug', [league]))
  t.deepEqual(res, { id: league, matches: [match] })
})

test('find references recursive', async (t) => {
  const client = t.context.client

  const mainThing = await client.set({
    $id: 'thMain',
    type: 'thing',
    name: 'Main thing',
    subthings: [
      {
        $id: 'th1',
        type: 'thing',
        name: 'sub 1',
        subthings: [
          {
            $id: 'th2',
            type: 'thing',
            name: 'sub 2',
            subthings: [
              {
                $id: 'th3',
                type: 'thing',
                name: 'sub 3',
                subthings: [
                  {
                    $id: 'th4',
                    type: 'thing',
                    name: 'sub 4',
                  },
                  {
                    $id: 'th6',
                    type: 'thing',
                    name: 'sub 6',
                  },
                  {
                    $id: 'th7',
                    type: 'thing',
                    name: 'sub 7',
                  },
                ],
              },
              {
                $id: 'th5',
                type: 'thing',
                name: 'sub 5',
              },
            ],
          },
          {
            $id: 'th8',
            type: 'thing',
            name: 'sub 8',
            subthings: [
              {
                $id: 'th10',
                type: 'thing',
                name: 'sub 10',
              },
            ],
          },
        ],
      },
      {
        $id: 'th9',
        type: 'thing',
        name: 'sub 9',
      },
    ],
  })

  const q = {
    $id: mainThing,
    items: {
      name: true,
      $list: {
        $find: {
          $traverse: 'subthings',
          $recursive: true,
          $filter: [
            {
              $field: 'type',
              $operator: '=',
              $value: 'thing',
            },
          ],
        },
      },
    },
  }

  let results: any[] = []
  subscribe(client, q, (d: any) => {
    // console.log('ddd', d)
    results.push(deepCopy(d))
  })

  await wait(1e3)

  await client.set({
    $id: 'th10',
    name: 'sub 10!',
  })

  await wait(1e3)

  deepEqualIgnoreOrder(t, results, [
    {
      items: [
        { name: 'sub 1' },
        { name: 'sub 2' },
        { name: 'sub 3' },
        { name: 'sub 4' },
        { name: 'sub 5' },
        { name: 'sub 6' },
        { name: 'sub 7' },
        { name: 'sub 8' },
        { name: 'sub 9' },
        { name: 'sub 10' },
      ],
    },
    {
      items: [
        { name: 'sub 1' },
        { name: 'sub 2' },
        { name: 'sub 3' },
        { name: 'sub 4' },
        { name: 'sub 5' },
        { name: 'sub 6' },
        { name: 'sub 7' },
        { name: 'sub 8' },
        { name: 'sub 9' },
        { name: 'sub 10!' },
      ],
    },
  ])
})
