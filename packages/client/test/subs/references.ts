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
}

test.serial('add new reference', async (t) => {
  await startSubs(t, schema)
  const client = t.context.dbClient

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
  observe(
    t,
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
    (v) => {
      res = v
    }
  )

  await wait(100)
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
  await wait(100)
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
  await wait(100)
  await client.set({
    $id: 'ma3',
    completedAt: { $delete: true },
  })
  await wait(100)

  //const subs = await client.redis.selva_subscriptions_list('___selva_hierarchy')
  //console.log(subs)
  //console.log(await client.redis.selva_subscriptions_debug('___selva_hierarchy', subs[0]))
  //console.log('ma1', await client.command('subscriptions.debug', ['ma1']))
  //console.log('ma2', await client.command('subscriptions.debug', ['ma2']))
  //console.log('ma3', await client.command('subscriptions.debug', ['ma3']))

  t.deepEqual(res, { ongoing: [{ id: 'ma1' }, { id: 'ma2' }, { id: 'ma3' }] })

  await client.delete({ $id: 'ma2' })
  await wait(100)
  t.deepEqual(res, { ongoing: [{ id: 'ma1' }, { id: 'ma3' }] })
})

test.serial('add new reference reverse', async (t) => {
  await startSubs(t, schema)
  const client = t.context.dbClient

  const league = await client.set({
    type: 'league',
    name: 'Best',
  })

  let res: any
  observe(
    t,
    {
      $id: league,
      id: true,
      matches: true,
    },
    (v) => {
      res = v
    }
  )

  await wait(100)
  const match = await client.set({
    type: 'match',
    league,
  })
  await wait(100)

  //console.log(await client.command('subscriptions.debug', [league]))
  t.deepEqual(res, { id: league, matches: [match] })
})
