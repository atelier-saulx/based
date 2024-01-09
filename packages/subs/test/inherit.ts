import { deepCopy, wait } from '@saulx/utils'
import { basicTest, deepEqualIgnoreOrder } from './assertions/index.js'
import { subscribe } from '../src/index.js'

const test = basicTest({
  language: 'en',
  translations: ['de', 'nl'],
  root: {
    fields: {
      yesh: { type: 'string' },
      no: { type: 'string' },
      flapper: {
        type: 'object',
        properties: {
          snurk: { type: 'json' },
          bob: { type: 'json' },
        },
      },
    },
  },
  types: {
    yeshType: {
      prefix: 'ye',
      fields: {
        yesh: { type: 'string' },
        no: { type: 'string' },
        flapper: {
          type: 'object',
          properties: {
            snurk: { type: 'json' },
            bob: { type: 'json' },
          },
        },
      },
    },
  },
})

test('inherit object nested field from root youzi', async (t) => {
  const client = t.context.client

  await wait(200)

  await client.set({
    $id: 'root',
    flapper: {
      snurk: 'hello',
      bob: 'xxx',
    },
  })

  await client.set({
    $id: 'yeA',
    parents: ['root'],
  })

  const results: any[] = []
  subscribe(
    client,
    {
      $id: 'yeA',
      flapper: { snurk: { $inherit: true } },
    },
    (p: any) => {
      // its now not immatable - think about if we want it immutable
      results.push(deepCopy(p))
    }
  )

  await wait(2000)

  await client.set({
    $id: 'root',
    flapper: {
      snurk: 'snurkels',
    },
  })

  await wait(2000)

  t.deepEqual(results, [
    { flapper: { snurk: 'hello' } },
    { flapper: { snurk: 'snurkels' } },
  ])

  t.true(true)
})

test('inherit object youzi', async (t) => {
  const client = t.context.client

  await wait(200)

  await client.set({
    $id: 'yeA',
    flapper: {
      snurk: 'hello',
      bob: 'xxx',
    },
  })

  const results: any[] = []
  subscribe(
    client,
    {
      $id: 'yeA',
      flapper: { $inherit: { $type: 'yeshType' } },
    },
    (p: any) => {
      results.push(deepCopy(p))
    }
  )

  await wait(1000)

  await client.set({
    $id: 'yeA',
    flapper: {
      snurk: 'snurkels',
    },
  })

  await wait(1000)

  t.deepEqual(results, [
    { flapper: { snurk: 'hello', bob: 'xxx' } },
    { flapper: { snurk: 'snurkels', bob: 'xxx' } },
  ])
})

test('basic inherit subscription', async (t) => {
  const client = t.context.client

  await client.set({
    $id: 'root',
    yesh: 'yesh',
    no: 'no',
  })

  await client.set({
    $id: 'yeA',
    yesh: 'yesh a',
  })

  await client.set({
    $id: 'yeB',
    parents: ['yeA'],
  })

  const results: any = []

  subscribe(
    client,
    {
      $id: 'yeB',
      yesh: { $inherit: true },
    },
    (p: any) => {
      results.push(deepCopy(p))
    }
  )

  await wait(1000)

  await Promise.all(
    (
      await client.command('subscriptions.list', [])
    )[0].map(([subId]) => {
      return client.command('subscriptions.debug', ['' + Number(subId)])
    })
  )

  await client.set({
    $id: 'yeA',
    yesh: 'yesh a!',
  })

  await wait(1000)

  await client.set({
    $id: 'yeB',
    yesh: 'yesh b',
  })

  await wait(1000)

  t.deepEqual(results, [
    { yesh: 'yesh a' },
    { yesh: 'yesh a!' },
    { yesh: 'yesh b' },
  ])
})

test('inherit object', async (t) => {
  const client = t.context.client

  await wait(200)

  await client.set({
    $id: 'root',
    flapper: {
      snurk: 'hello',
      bob: 'xxx',
    },
  })

  await client.set({
    $id: 'yeA',
    parents: ['root'],
  })

  await client.set({
    $id: 'yeB',
    parents: ['yeA'],
  })

  t.deepEqual(
    await client.get({
      $id: 'yeB',
      flapper: { $inherit: true },
    }),
    {
      flapper: {
        snurk: 'hello',
        bob: 'xxx',
      },
    }
  )

  const results: any = []
  subscribe(
    client,
    {
      $id: 'yeB',
      flapper: { $inherit: true },
    },
    (p: any) => {
      results.push(deepCopy(p))
    }
  )

  await wait(500)

  await client.set({
    $id: 'yeA',
    flapper: {
      snurk: 'snurkels',
    },
  })

  await wait(500)

  await client.set({
    $id: 'yeB',
    flapper: {
      snurk: 'power bro',
    },
  })

  await wait(500)

  t.deepEqual(results, [
    { flapper: { snurk: 'hello', bob: 'xxx' } },
    { flapper: { snurk: 'snurkels' } },
    { flapper: { snurk: 'power bro' } },
  ])
})

test('list inherit subscription', async (t) => {
  const client = t.context.client

  await wait(200)

  await client.set({
    $id: 'root',
    yesh: 'yesh',
    no: 'no',
  })

  await client.set({
    $id: 'yeA',
    yesh: 'yesh a',
  })

  await client.set({
    $id: 'yeB',
    parents: ['yeA'],
  })

  for (let i = 0; i < 2; i++) {
    await client.set({
      $id: 'ye' + i,
      parents: ['yeA'],
    })
  }

  // console.log(
  //   '---------',
  //   await client.get({
  //     $id: 'yeA',
  //     flapdrol: {
  //       id: true,
  //       yesh: { $inherit: true },
  //       $field: 'children',
  //       $list: true,
  //     },
  //   })
  // )
  const results: any[] = []
  subscribe(
    client,
    {
      $id: 'yeA',
      flapdrol: {
        id: true,
        yesh: { $inherit: true },
        $field: 'children',
        $list: true,
      },
    },
    (p: any) => {
      results.push(deepCopy(p))
    }
  )

  await wait(1000)

  await client.set({
    $id: 'yeA',
    yesh: 'yesh a!',
  })

  await wait(1000)

  await client.set({
    $id: 'yeB',
    yesh: 'yesh b',
  })

  await wait(1000)

  deepEqualIgnoreOrder(t, results, [
    {
      flapdrol: [
        { id: 'ye0', yesh: 'yesh a' },
        { id: 'yeB', yesh: 'yesh a' },
        { id: 'ye1', yesh: 'yesh a' },
      ],
    },
    {
      flapdrol: [
        { id: 'ye0', yesh: 'yesh a!' },
        { id: 'yeB', yesh: 'yesh a!' },
        { id: 'ye1', yesh: 'yesh a!' },
      ],
    },
    {
      flapdrol: [
        { id: 'ye0', yesh: 'yesh a!' },
        { id: 'yeB', yesh: 'yesh b' },
        { id: 'ye1', yesh: 'yesh a!' },
      ],
    },
  ])
})

test('list inherit + field subscription', async (t) => {
  const client = t.context.client

  await client.set({
    $id: 'root',
    yesh: 'yesh',
  })

  await client.set({
    $id: 'yeA',
    yesh: 'yesh a',
    no: 'no',
  })

  await client.set({
    $id: 'yeB',
    parents: ['yeA'],
  })

  for (let i = 0; i < 2; i++) {
    await client.set({
      $id: 'ye' + i,
      parents: ['yeA'],
    })
  }

  const results: any[] = []

  // console.log(
  //   '---------',
  //   await client.get({
  //     $id: 'yeA',
  //     flapdrol: {
  //       id: true,
  //       yesh: {
  //         $field: 'no',
  //         $inherit: true,
  //       },
  //       $field: 'children',
  //       $list: true,
  //     },
  //   })
  // )
  subscribe(
    client,
    {
      $id: 'yeA',
      flapdrol: {
        id: true,
        yesh: {
          $field: 'no',
          $inherit: true,
        },
        $field: 'children',
        $list: true,
      },
    },
    (p: any) => {
      results.push(deepCopy(p))
    }
  )

  await wait(1000)

  await client.set({
    $id: 'yeA',
    no: 'no!',
  })

  await wait(1000)

  await client.set({
    $id: 'yeB',
    no: 'o yes?',
  })

  const x = await client.get({
    $id: 'yeB',
    id: true,
    yesh: {
      $field: 'no',
      $inherit: true,
    },
  })

  t.deepEqual(
    x,
    {
      id: 'yeB',
      yesh: 'o yes?',
    },
    'get'
  )

  await wait(1000)

  deepEqualIgnoreOrder(t, results, [
    {
      flapdrol: [
        { id: 'ye0', yesh: 'no' },
        { id: 'yeB', yesh: 'no' },
        { id: 'ye1', yesh: 'no' },
      ],
    },
    {
      flapdrol: [
        { id: 'ye0', yesh: 'no!' },
        { id: 'yeB', yesh: 'no!' },
        { id: 'ye1', yesh: 'no!' },
      ],
    },
    {
      flapdrol: [
        { id: 'yeB', yesh: 'o yes?' },
        { id: 'ye0', yesh: 'no!' },
        { id: 'ye1', yesh: 'no!' },
      ],
    },
  ])
})
