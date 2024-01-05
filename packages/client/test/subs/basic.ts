import { wait } from '@saulx/utils'
import { basicTest, deepEqualIgnoreOrder } from '../assertions/index.js'
import { subscribe } from '@based/db-subs'

const test = basicTest({
  language: 'en',
  translations: ['de', 'nl'],
  root: {
    fields: { yesh: { type: 'string' }, no: { type: 'string' } },
  },
  types: {
    hello: {
      fields: {
        name: { type: 'string' },
        lol: {
          type: 'record',
          values: {
            type: 'object',
            properties: {
              x: { type: 'string' },
              y: { type: 'string' },
            },
          },
        },
      },
    },
    yeshType: {
      prefix: 'ye',
      fields: {
        hmm: { type: 'number' },
        yesh: { type: 'string' },
        myRef: { type: 'reference' },
      },
    },
    refType: {
      prefix: 're',
      fields: {
        yesh: { type: 'string' },
        myRef: { type: 'reference' },
      },
    },
  },
})

test('basic id based subscriptions', async (t) => {
  const client = t.context.client

  t.plan(4)

  let o1counter = 0
  subscribe(client, { $id: 'root', yesh: true }, (d: any) => {
    if (o1counter === 0) {
      // gets start event
      t.is(d?.yesh, undefined)
    } else if (o1counter === 1) {
      // gets update event
      deepEqualIgnoreOrder(t, d, { yesh: 'so nice' })
    } else {
      // doesn't get any more events
      t.fail()
    }

    o1counter++
  })

  const thing = await client.set({
    type: 'yeshType',
    yesh: 'extra nice',
  })

  let o2counter = 0
  subscribe(client, { $id: thing, $all: true, aliases: false }, (d: any) => {
    if (o2counter === 0) {
      // gets start event
      deepEqualIgnoreOrder(t, d, {
        id: thing,
        type: 'yeshType',
        yesh: 'extra nice',
      })
    } else if (o2counter === 1) {
      // gets delete event
      deepEqualIgnoreOrder(t, d, {})
    } else {
      t.fail()
    }
    o2counter++
  })

  await wait(500 * 2)

  await client.set({
    $id: 'root',
    no: 'no event pls',
  })

  await client.set({
    $id: 'root',
    yesh: 'so nice',
  })

  await client.delete({
    $id: thing,
  })

  await wait(500 * 2)

  // sub.unsubscribe()
  // sub2.unsubscribe()

  await wait(500 * 2)
})

test('basic id based nested query subscriptions', async (t) => {
  const client = t.context.client

  t.plan(2)

  const thing = await client.set({
    type: 'yeshType',
    yesh: 'extra nice',
  })

  let o2counter = 0
  subscribe(
    client,
    {
      $id: 'root',
      item: {
        $id: thing,
        $all: true,
        updatedAt: false,
        createdAt: false,
        aliases: false,
      },
    },
    (d: any) => {
      if (o2counter === 0) {
        // gets start event
        deepEqualIgnoreOrder(t, d, {
          item: {
            id: thing,
            type: 'yeshType',
            yesh: 'extra nice',
          },
        })
      } else if (o2counter === 1) {
        // gets delete event
        deepEqualIgnoreOrder(t, d, {})
      } else {
        t.fail()
      }
      o2counter++
    }
  )

  await wait(500 * 2)

  await client.set({
    $id: 'root',
    no: 'no event pls',
  })

  await client.set({
    $id: 'root',
    yesh: 'so nice',
  })

  await client.delete({
    $id: thing,
  })

  await wait(500 * 2)
})

test('using $field works', async (t) => {
  const client = t.context.client

  t.plan(2)

  let o1counter = 0
  subscribe(
    client,
    {
      $id: 'root',
      id: true,
      aliasedField: { $field: 'yesh' },
    },
    (d: any) => {
      if (o1counter === 0) {
        // gets start event
        deepEqualIgnoreOrder(t, d, { id: 'root' })
      } else if (o1counter === 1) {
        // gets update event
        deepEqualIgnoreOrder(t, d, { id: 'root', aliasedField: 'so nice' })
      } else {
        // doesn't get any more events
        t.fail()
      }
      o1counter++
    }
  )

  await wait(1000 * 1)

  await client.set({
    $id: 'root',
    yesh: 'so nice',
  })

  await wait(1000 * 1)
})

test('basic $inherit when ancestors change', async (t) => {
  const client = t.context.client

  t.plan(2)

  const thing = await client.set({
    type: 'yeshType',
    hmm: 0,
  })

  let o1counter = 0
  subscribe(
    client,
    {
      $id: thing,
      id: true,
      yesh: { $inherit: { $type: ['yeshType', 'root'] } },
    },

    (d: any) => {
      if (o1counter === 0) {
        // gets start event
        deepEqualIgnoreOrder(t, d, { id: thing })
      } else if (o1counter === 1) {
        // gets update event
        deepEqualIgnoreOrder(t, d, { id: thing, yesh: 'so nice' })
      } else {
        // doesn't get any more events
        t.fail()
      }
      o1counter++
    }
  )

  await wait(1000 * 1)

  await client.set({
    type: 'yeshType',
    yesh: 'so nice',
    children: [thing],
  })

  await wait(1000 * 1)
})

test('basic id based reference subscriptions', async (t) => {
  const client = t.context.client

  t.plan(4)

  await client.set({
    $id: 're2',
    yesh: 'hello from 2',
  })

  await client.set({
    $id: 're1',
    yesh: 'hello from 1',
    myRef: 're2',
  })

  let o1counter = 0
  subscribe(
    client,
    {
      $id: 're1',
      yesh: true,
      myRef: {
        type: true,
        yesh: true,
      },
    },
    (d: any) => {
      if (o1counter === 0) {
        // gets start event
        deepEqualIgnoreOrder(t, d, {
          yesh: 'hello from 1',
          myRef: { type: 'refType', yesh: 'hello from 2' },
        })
      } else if (o1counter === 1) {
        // gets update event
        deepEqualIgnoreOrder(t, d, {
          yesh: 'hello from 1!',
          myRef: { type: 'refType', yesh: 'hello from 2' },
        })
      } else if (o1counter === 2) {
        deepEqualIgnoreOrder(t, d, {
          yesh: 'hello from 1!',
          myRef: { type: 'refType', yesh: 'hello from 2!' },
        })
      } else if (o1counter === 3) {
        deepEqualIgnoreOrder(t, d, {
          yesh: 'hello from 1!',
          myRef: { type: 'refType', yesh: 'hello from 3...' },
        })
      } else {
        // doesn't get any more events
        t.fail()
      }
      o1counter++
    }
  )

  await wait(500 * 2)

  await client.set({
    $id: 're1',
    yesh: 'hello from 1!',
  })

  await wait(500 * 2)

  await Promise.all(
    (
      await client.command('subscriptions.list', [])
    )[0].map(([subId]) => {
      return client.command('subscriptions.debug', ['' + Number(subId)])
    })
  )
  await client.set({
    $id: 're2',
    yesh: 'hello from 2!',
  })

  await wait(500 * 2)

  await client.set({
    $id: 're3',
    yesh: 'hello from 3...',
  })
  await client.set({
    $id: 're1',
    myRef: 're3',
  })

  await wait(500 * 2)

  await Promise.all(
    (
      await client.command('subscriptions.list', [])
    )[0].map(([subId]) => {
      return client.command('subscriptions.debug', ['' + Number(subId)])
    })
  )
})

test('subscribe with timeout right away record', async (t) => {
  const client = t.context.client

  t.plan(2)

  const id = await client.set({
    type: 'hello',
    name: 'derp',
  })

  subscribe(
    client,
    {
      $id: id,
      name: true,
      lol: {
        '*': {
          x: true,
          y: true,
        },
      },
    },
    (data: any) => {
      if (data.name && !data.lol) t.is(data.name, 'derp')
      if (data.name && data.lol) t.is(data.name, 'haha')
    }
  )

  await wait(300)

  await client.set({
    $id: id,
    name: 'haha',
    lol: {
      yes: {
        y: 'yyyyyyyyyyyyy',
      },
    },
  })

  await wait(1000)
})

test('subscribe to descendants: true in list', async (t) => {
  const client = t.context.client

  t.plan(4)

  await client.set({
    $id: 're1',
    yesh: 'hello from 1',
  })

  await client.set({
    $id: 're2',
    yesh: 'hello from 2',
    parents: ['re1'],
  })

  let o1counter = 0
  let res: any
  subscribe(
    client,
    {
      $id: 'root',
      descendants: true,
    },
    (d: any) => {
      o1counter++
      res = d
    }
  )

  await wait(500 * 2)
  t.deepEqual(o1counter, 1)
  deepEqualIgnoreOrder(t, res, { descendants: ['re1', 're2'] })

  await client.set({
    $id: 're3',
    yesh: 'hello from 3',
    parents: ['re2'],
  })

  await wait(500 * 2)

  t.deepEqual(o1counter, 2)
  deepEqualIgnoreOrder(t, res, { descendants: ['re1', 're2', 're3'] })

  await Promise.all(
    (
      await client.command('subscriptions.list', [])
    )[0].map(([subId]) => {
      return client.command('subscriptions.debug', ['' + Number(subId)])
    })
  )
})
