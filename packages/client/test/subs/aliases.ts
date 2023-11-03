import anyTest, { TestInterface } from 'ava'
import { wait } from '@saulx/utils'
import '../assertions'
import { TestCtx, observe, startSubs } from '../assertions'

const test = anyTest as TestInterface<TestCtx>

test.serial('changing alias to another node fires subscription', async (t) => {
  await startSubs(t, {})
  const client = t.context.dbClient

  await client.updateSchema({
    language: 'en',
    translations: ['de', 'nl'],
    root: {
      fields: { yesh: { type: 'string' }, no: { type: 'string' } },
    },
    types: {
      yeshType: {
        prefix: 'ye',
        fields: {
          yesh: { type: 'string' },
        },
      },
    },
  })

  t.plan(2)

  await client.set({
    $id: 'yebba',
    yesh: 'pretty nice',
    aliases: { $add: 'hello-friend' },
  })

  let o1counter = 0
  observe(
    t,
    {
      $alias: 'hello-friend',
      yesh: true,
    },
    (d) => {
      if (o1counter === 0) {
        // gets start event
        t.is(d.yesh, 'pretty nice')
      } else if (o1counter === 1) {
        // gets update event
        t.deepEqualIgnoreOrder(d, { yesh: 'extra nice' })
      } else {
        // doesn't get any more evente
        t.fail()
      }
      o1counter++
    }
  )

  await wait(500 * 2)

  await client.set({
    $id: 'yebbe',
    yesh: 'extra nice',
    aliases: { $add: 'hello-friend' },
  })

  await wait(500 * 2)
})
