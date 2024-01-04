import anyTest, { TestFn } from 'ava'
import { BasedDbClient } from '../src'
import { startOrigin } from '../../server/dist'
import { SelvaServer } from '../../server/dist/server'
import getPort from 'get-port'
import './assertions'

const test = anyTest as TestFn<{
  srv: SelvaServer
  client: BasedDbClient
  port: number
}>

test.beforeEach(async (t) => {
  t.context.port = await getPort()
  console.log('origin')
  t.context.srv = await startOrigin({
    port: t.context.port,
    name: 'default',
  })

  console.log('connecting')
  t.context.client = new BasedDbClient()
  t.context.client.connect({
    port: t.context.port,
    host: '127.0.0.1',
  })
})

test.afterEach.always(async (t) => {
  const { srv, client } = t.context
  await srv.destroy()
  client.destroy()
})

test('get - simple $list', async (t) => {
  const { client } = t.context
  await client.updateSchema({
    language: 'en',
    translations: ['de', 'nl'],
    types: {
      custom: {
        prefix: 'cu',
        fields: {
          related: { type: 'references' },
          name: { type: 'string' },
          value: { type: 'number' },
          age: { type: 'number' },
          auth: {
            type: 'json',
          },
          title: { type: 'text' },
          description: { type: 'text' },
          image: {
            type: 'object',
            properties: {
              thumb: { type: 'string' },
              poster: { type: 'string' },
            },
          },
        },
      },
    },
  })

  const children: any = []

  for (let i = 0; i < 100; i++) {
    children.push({
      type: 'custom',
      value: i,
      name: 'flurp' + i,
    })
  }

  await Promise.all([
    client.set({
      $id: 'cuA',
      image: {
        thumb: 'flurp.jpg',
      },
      title: { en: 'snurf' },
      children,
    }),
  ])

  const c = await client.get({
    $id: 'cuA',
    children: {
      name: true,
      value: true,
      $list: {
        $sort: { $field: 'value', $order: 'asc' },
        $limit: 10,
      },
    },
  })

  t.deepEqual(
    c,
    {
      children: [
        { value: 0, name: 'flurp0' },
        { value: 1, name: 'flurp1' },
        { value: 2, name: 'flurp2' },
        { value: 3, name: 'flurp3' },
        { value: 4, name: 'flurp4' },
        { value: 5, name: 'flurp5' },
        { value: 6, name: 'flurp6' },
        { value: 7, name: 'flurp7' },
        { value: 8, name: 'flurp8' },
        { value: 9, name: 'flurp9' },
      ],
    },
    'non redis search sort'
  )

  const { children: rangeResult } = await client.get({
    $id: 'cuA',
    children: {
      name: true,
      value: true,
      $list: {
        $limit: 10,
      },
    },
  })

  t.is(rangeResult.length, 10, 'non redis search range')

  /*
  const x = await client.get({
    $id: 'cuA',
    related: {
      $inherit: true,
      name: true,
      value: true,
      $list: {
        $sort: { $field: 'value', $order: 'asc' },
        $range: [0, 10]
      }
    }
  })
  */
})

test('get - simple $list with $field of one field', async (t) => {
  const { client } = t.context
  await client.updateSchema({
    language: 'en',
    translations: ['de', 'nl'],
    types: {
      custom: {
        prefix: 'cu',
        fields: {
          name: { type: 'string' },
          value: { type: 'number' },
          age: { type: 'number' },
          auth: {
            type: 'json',
          },
          title: { type: 'text' },
          description: { type: 'text' },
          image: {
            type: 'object',
            properties: {
              thumb: { type: 'string' },
              poster: { type: 'string' },
            },
          },
        },
      },
    },
  })

  const children: any = []

  for (let i = 0; i < 100; i++) {
    children.push({
      type: 'custom',
      value: i,
      name: 'flurp' + i,
    })
  }

  await Promise.all([
    client.set({
      $id: 'cuA',
      image: {
        thumb: 'flurp.jpg',
      },
      title: { en: 'snurf' },
      children,
    }),
  ])

  const c = await client.get({
    $id: 'cuA',
    otherName: {
      name: true,
      value: true,
      $field: 'children',
      $list: {
        $sort: { $field: 'value', $order: 'asc' },
        $limit: 10,
      },
    },
  })

  t.deepEqual(
    c,
    {
      otherName: [
        { value: 0, name: 'flurp0' },
        { value: 1, name: 'flurp1' },
        { value: 2, name: 'flurp2' },
        { value: 3, name: 'flurp3' },
        { value: 4, name: 'flurp4' },
        { value: 5, name: 'flurp5' },
        { value: 6, name: 'flurp6' },
        { value: 7, name: 'flurp7' },
        { value: 8, name: 'flurp8' },
        { value: 9, name: 'flurp9' },
      ],
    },
    'non redis search sort'
  )
})

test('get - simple $list with $field of two field entries', async (t) => {
  const { client } = t.context
  await client.updateSchema({
    language: 'en',
    translations: ['de', 'nl'],
    types: {
      custom: {
        prefix: 'cu',
        fields: {
          name: { type: 'string' },
          value: { type: 'number' },
          age: { type: 'number' },
          auth: {
            type: 'json',
          },
          related: { type: 'references' },
          title: { type: 'text' },
          description: { type: 'text' },
          image: {
            type: 'object',
            properties: {
              thumb: { type: 'string' },
              poster: { type: 'string' },
            },
          },
        },
      },
    },
  })

  const children: any = []

  for (let i = 0; i < 100; i++) {
    children.push({
      type: 'custom',
      value: i,
      name: 'flurp' + i,
    })
  }

  await Promise.all([
    client.set({
      $id: 'cuA',
      image: {
        thumb: 'flurp.jpg',
      },
      title: { en: 'snurf' },
      children,
    }),
  ])

  const c = await client.get({
    $id: 'cuA',
    otherName: {
      name: true,
      value: true,
      $field: ['related', 'children'],
      $list: {
        $sort: { $field: 'value', $order: 'asc' },
        $limit: 10,
      },
    },
  })

  t.deepEqual(
    c,
    {
      otherName: [
        { value: 0, name: 'flurp0' },
        { value: 1, name: 'flurp1' },
        { value: 2, name: 'flurp2' },
        { value: 3, name: 'flurp3' },
        { value: 4, name: 'flurp4' },
        { value: 5, name: 'flurp5' },
        { value: 6, name: 'flurp6' },
        { value: 7, name: 'flurp7' },
        { value: 8, name: 'flurp8' },
        { value: 9, name: 'flurp9' },
      ],
    },
    'non redis search sort'
  )
})

test('get - simple $list nested query structure', async (t) => {
  const { client } = t.context
  await client.updateSchema({
    language: 'en',
    translations: ['de', 'nl'],
    types: {
      custom: {
        prefix: 'cu',
        fields: {
          name: { type: 'string' },
          value: { type: 'number' },
          age: { type: 'number' },
          auth: {
            type: 'json',
          },
          title: { type: 'text' },
          description: { type: 'text' },
          image: {
            type: 'object',
            properties: {
              thumb: { type: 'string' },
              poster: { type: 'string' },
            },
          },
        },
      },
    },
  })

  const children: any = []

  for (let i = 0; i < 100; i++) {
    children.push({
      type: 'custom',
      value: i,
      name: 'flurp' + i,
    })
  }

  await Promise.all([
    client.set({
      $id: 'cuA',
      image: {
        thumb: 'flurp.jpg',
      },
      title: { en: 'snurf' },
      children,
    }),
  ])

  let c = await client.get({
    $id: 'cuA',
    hello: {
      yesyes: {
        children: {
          $field: 'children',
          name: true,
          value: true,
          $list: {
            $sort: { $field: 'value', $order: 'asc' },
            $limit: 10,
          },
        },
      },
    },
  })

  t.deepEqual(
    c,
    {
      hello: {
        yesyes: {
          children: [
            { value: 0, name: 'flurp0' },
            { value: 1, name: 'flurp1' },
            { value: 2, name: 'flurp2' },
            { value: 3, name: 'flurp3' },
            { value: 4, name: 'flurp4' },
            { value: 5, name: 'flurp5' },
            { value: 6, name: 'flurp6' },
            { value: 7, name: 'flurp7' },
            { value: 8, name: 'flurp8' },
            { value: 9, name: 'flurp9' },
          ],
        },
      },
    },
    'non redis search sort'
  )

  c = await client.get({
    $id: 'cuA',
    hello: {
      yesyes: {
        children: {
          $field: 'children',
          name: true,
          value: true,
          $list: {
            $sort: { $field: 'value', $order: 'asc' },
            $limit: 10,
            $offset: 10,
          },
        },
      },
    },
  })

  t.deepEqual(
    c,
    {
      hello: {
        yesyes: {
          children: [
            { value: 10, name: 'flurp10' },
            { value: 11, name: 'flurp11' },
            { value: 12, name: 'flurp12' },
            { value: 13, name: 'flurp13' },
            { value: 14, name: 'flurp14' },
            { value: 15, name: 'flurp15' },
            { value: 16, name: 'flurp16' },
            { value: 17, name: 'flurp17' },
            { value: 18, name: 'flurp18' },
            { value: 19, name: 'flurp19' },
          ],
        },
      },
    },
    'non redis search sort'
  )

  const { children: rangeResult } = await client.get({
    $id: 'cuA',
    children: {
      name: true,
      value: true,
      $list: {
        $limit: 10,
      },
    },
  })

  t.is(rangeResult.length, 10, 'non redis search range')

  /*
  const x = await client.get({
    $id: 'cuA',
    related: {
      $inherit: true,
      name: true,
      value: true,
      $list: {
        $sort: { $field: 'value', $order: 'asc' },
        $range: [0, 10]
      }
    }
  })
  */
})

test('get - default sorting in $list with references', async (t) => {
  const { client } = t.context
  await client.updateSchema({
    language: 'en',
    translations: ['de', 'nl'],
    types: {
      custom: {
        prefix: 'cu',
        fields: {
          name: { type: 'string' },
          value: { type: 'number' },
          age: { type: 'number' },
          auth: {
            type: 'json',
          },
          title: { type: 'text' },
          description: { type: 'text' },
          image: {
            type: 'object',
            properties: {
              thumb: { type: 'string' },
              poster: { type: 'string' },
            },
          },
        },
      },
    },
  })

  const children: any = []

  for (let i = 0; i < 100; i++) {
    children.push({
      $id: 'cu' + String(i).padStart(3, '0'),
      type: 'custom',
      value: i,
      name: 'flurp' + i,
    })
  }

  await Promise.all([
    client.set({
      $id: 'cuA',
      image: {
        thumb: 'flurp.jpg',
      },
      title: { en: 'snurf' },
      children,
    }),
  ])

  let c = await client.get({
    $id: 'cuA',
    children: {
      name: true,
      value: true,
      $list: {
        $limit: 10,
      },
    },
  })

  t.deepEqual(
    c,
    {
      children: [
        { value: 0, name: 'flurp0' },
        { value: 1, name: 'flurp1' },
        { value: 2, name: 'flurp2' },
        { value: 3, name: 'flurp3' },
        { value: 4, name: 'flurp4' },
        { value: 5, name: 'flurp5' },
        { value: 6, name: 'flurp6' },
        { value: 7, name: 'flurp7' },
        { value: 8, name: 'flurp8' },
        { value: 9, name: 'flurp9' },
      ],
    },
    'non redis search sort'
  )

  c = await client.get({
    $id: 'cuA',
    otherName: {
      name: true,
      value: true,
      $field: ['related', 'children'],
      $list: {
        $offset: 10,
        $sort: { $field: 'value', $order: 'asc' },
        $limit: 10,
      },
    },
  })

  t.deepEqual(
    c,
    {
      otherName: [
        { value: 10, name: 'flurp10' },
        { value: 11, name: 'flurp11' },
        { value: 12, name: 'flurp12' },
        { value: 13, name: 'flurp13' },
        { value: 14, name: 'flurp14' },
        { value: 15, name: 'flurp15' },
        { value: 16, name: 'flurp16' },
        { value: 17, name: 'flurp17' },
        { value: 18, name: 'flurp18' },
        { value: 19, name: 'flurp19' },
      ],
    },
    'non redis search sort'
  )

  /*
  const x = await client.get({
    $id: 'cuA',
    related: {
      $inherit: true,
      name: true,
      value: true,
      $list: {
        $sort: { $field: 'value', $order: 'asc' },
        $range: [0, 10]
      }
    }
  })
  */
})

test('get - simple $list with $field option', async (t) => {
  const { client } = t.context
  await client.updateSchema({
    language: 'en',
    translations: ['de', 'nl'],
    types: {
      custom: {
        prefix: 'cu',
        fields: {
          name: { type: 'string' },
          value: { type: 'number' },
          age: { type: 'number' },
          auth: {
            type: 'json',
          },
          title: { type: 'text' },
          description: { type: 'text' },
          image: {
            type: 'object',
            properties: {
              thumb: { type: 'string' },
              poster: { type: 'string' },
            },
          },
        },
      },
    },
  })

  const children: any = []

  for (let i = 0; i < 100; i++) {
    const opts: any = {
      type: 'custom',
      value: i,
      name: 'flurp' + i,
    }

    if (i % 2) {
      opts.image = { thumb: 'flurp' + i }
    }

    children.push(opts)
  }

  await Promise.all([
    client.set({
      $id: 'cuA',
      image: {
        thumb: 'flurp.jpg',
      },
      title: { en: 'snurf' },
      children,
    }),
  ])

  const c = await client.get({
    $id: 'cuA',
    children: {
      title: { $field: 'name' },
      value: true,
      image: { thumb: { $default: 'default_image.jpg' } },
      $list: {
        $sort: { $field: 'value', $order: 'asc' },
        $limit: 10,
      },
    },
  })

  t.log(JSON.stringify(c, null, 2))
  t.deepEqual(
    c,
    {
      children: [
        { value: 0, title: 'flurp0', image: { thumb: 'default_image.jpg' } },
        { value: 1, title: 'flurp1', image: { thumb: 'flurp1' } },
        { value: 2, title: 'flurp2', image: { thumb: 'default_image.jpg' } },
        { value: 3, title: 'flurp3', image: { thumb: 'flurp3' } },
        { value: 4, title: 'flurp4', image: { thumb: 'default_image.jpg' } },
        { value: 5, title: 'flurp5', image: { thumb: 'flurp5' } },
        { value: 6, title: 'flurp6', image: { thumb: 'default_image.jpg' } },
        { value: 7, title: 'flurp7', image: { thumb: 'flurp7' } },
        { value: 8, title: 'flurp8', image: { thumb: 'default_image.jpg' } },
        { value: 9, title: 'flurp9', image: { thumb: 'flurp9' } },
      ],
    },
    'non redis search sort'
  )

  const { children: rangeResult } = await client.get({
    $id: 'cuA',
    children: {
      title: { $field: 'name' },
      value: true,
      $list: {
        $limit: 10,
      },
    },
  })

  t.is(rangeResult.length, 10, 'non redis search range')

  /*
  const x = await client.get({
    $id: 'cuA',
    related: {
      $inherit: true,
      name: true,
      value: true,
      $list: {
        $sort: { $field: 'value', $order: 'asc' },
        $range: [0, 10]
      }
    }
  })
  */
})

test('get - edge meta sorting in $list with references', async (t) => {
  const { client } = t.context
  await client.updateSchema({
    language: 'en',
    translations: ['de', 'nl'],
    types: {
      custom: {
        prefix: 'cu',
        fields: {
          related: { type: 'references' },
          name: { type: 'string' },
          value: { type: 'number' },
          age: { type: 'number' },
          auth: {
            type: 'json',
          },
          title: { type: 'text' },
          description: { type: 'text' },
          image: {
            type: 'object',
            properties: {
              thumb: { type: 'string' },
              poster: { type: 'string' },
            },
          },
        },
      },
    },
  })

  const related: any = []

  for (let i = 0; i < 100; i++) {
    related.push({
      $id: 'cu' + String(i).padStart(3, '0'),
      type: 'custom',
      value: i,
      name: 'flurp' + i,
      $edgeMeta: {
        niceValue: 100 - i, // reverse order
      },
    })
  }

  await Promise.all([
    client.set({
      $id: 'cuA',
      image: {
        thumb: 'flurp.jpg',
      },
      title: { en: 'snurf' },
      related,
    }),
  ])

  let c = await client.get({
    $id: 'cuA',
    related: {
      name: true,
      value: true,
      $edgeMeta: true,
      $list: {
        $sort: { $field: '$edgeMeta.niceValue', $order: 'asc' },
        $limit: 10,
      },
    },
  })

  t.deepEqual(
    c,
    {
      related: [
        { value: 99, name: 'flurp99', $edgeMeta: { niceValue: 1 } },
        { value: 98, name: 'flurp98', $edgeMeta: { niceValue: 2 } },
        { value: 97, name: 'flurp97', $edgeMeta: { niceValue: 3 } },
        { value: 96, name: 'flurp96', $edgeMeta: { niceValue: 4 } },
        { value: 95, name: 'flurp95', $edgeMeta: { niceValue: 5 } },
        { value: 94, name: 'flurp94', $edgeMeta: { niceValue: 6 } },
        { value: 93, name: 'flurp93', $edgeMeta: { niceValue: 7 } },
        { value: 92, name: 'flurp92', $edgeMeta: { niceValue: 8 } },
        { value: 91, name: 'flurp91', $edgeMeta: { niceValue: 9 } },
        { value: 90, name: 'flurp90', $edgeMeta: { niceValue: 10 } },
      ],
    },
    'non redis search sort'
  )

  /*
  const x = await client.get({
    $id: 'cuA',
    related: {
      $inherit: true,
      name: true,
      value: true,
      $list: {
        $sort: { $field: 'value', $order: 'asc' },
        $range: [0, 10]
      }
    }
  })
  */
})
