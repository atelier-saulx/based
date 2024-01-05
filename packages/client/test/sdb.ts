import anyTest, { ExecutionContext, TestFn } from 'ava'
import { hierarchyCompressType } from '../src/protocol'
import { readdir } from 'fs/promises'
import { BasedDbClient } from '../src'
import { startOrigin } from '../../server/dist'
import { SelvaServer } from '../../server/dist/server'
import './assertions'
import getPort from 'get-port'
import { join } from 'path'
import { removeDump } from './assertions/utils'
import { wait } from '@saulx/utils'
import { deepEqualIgnoreOrder } from './assertions'

const dir = join(process.cwd(), 'tmp', 'sdb-test')

type Context = {
  srv: SelvaServer
  client: BasedDbClient
  port: number
}
const test = anyTest as TestFn<Context>

async function restartServer(t: ExecutionContext<Context>) {
  const port = t.context.port

  if (t.context.srv) {
    await t.context.srv.destroy()
  }

  t.context.srv = await startOrigin({
    port,
    name: 'default',
    dir,
  })

  // FIXME sometimes the client gets stuck after the server restarts, so we reconnect just in case
  if (t.context.client) {
    t.context.client.disconnect()
    t.context.client.connect({ port, host: '127.0.0.1' })
  }
}

test.beforeEach(async (t) => {
  removeDump(dir)

  t.context.port = await getPort()
  console.log('origin')
  restartServer(t)

  console.log('connecting')
  t.context.client = new BasedDbClient()
  t.context.client.connect({
    port: t.context.port,
    host: '127.0.0.1',
  })

  console.log('updating schema')
  await t.context.client.updateSchema({
    language: 'en',
    translations: ['de', 'nl'],
    root: {
      fields: {
        value: { type: 'number' },
        nested: {
          type: 'object',
          properties: {
            fun: { type: 'string' },
          },
        },
      },
    },
    types: {
      match: {
        prefix: 'ma',
        fields: {
          title: { type: 'text' },
          value: { type: 'number' },
          description: { type: 'text' },
          ref: { type: 'reference' },
        },
      },
      lekkerType: {
        prefix: 'vi',
        fields: {
          title: { type: 'text' },
          lekkerLink: {
            type: 'reference',
            bidirectional: {
              fromField: 'lekkerLink',
            },
          },
          fren: {
            type: 'reference',
          },
          strRec: {
            type: 'record',
            values: {
              type: 'string',
            },
          },
          stringAry: {
            type: 'array',
            values: {
              type: 'string',
            },
          },
          intAry: {
            type: 'array',
            values: {
              type: 'integer',
            },
          },
          doubleAry: {
            type: 'array',
            values: {
              type: 'number',
            },
          },
          objAry: {
            type: 'array',
            values: {
              type: 'object',
              properties: {
                textyText: {
                  type: 'text',
                },
                strField: {
                  type: 'string',
                },
                numField: {
                  type: 'integer',
                },
              },
            },
          },
          textRec: {
            type: 'record',
            values: {
              type: 'text',
            },
          },
          objRec: {
            type: 'record',
            values: {
              type: 'object',
              properties: {
                hello: {
                  type: 'string',
                },
                value: {
                  type: 'number',
                },
                stringValue: {
                  type: 'string',
                },
              },
            },
          },
        },
      },
    },
  })
})

test.afterEach(async (t) => {
  const { srv, client } = t.context
  await srv.destroy()
  client.destroy()
})

test.serial('can reload from SDB', async (t) => {
  const { client } = t.context

  await client.set({
    $id: 'viTest',
    title: { en: 'hello' },
    stringAry: ['hello', 'world'],
    doubleAry: [1.0, 2.1, 3.2],
    intAry: [7, 6, 5, 4, 0, 3, 2, 999],
    objAry: [
      {
        textyText: {
          en: 'hello 1',
          de: 'hallo 1',
        },
        strField: 'string value hello 1',
        numField: 112,
      },
      {
        textyText: {
          en: 'hello 2',
          de: 'hallo 2',
        },
        strField: 'string value hello 2',
        numField: 113,
      },
      {},
      { strField: 'hello' },
    ],
  })

  await client.set({
    $id: 'viLink1',
    title: { en: 'hi' },
    lekkerLink: {
      $id: 'viLink2',
      title: { en: 'yo' },
    },
    fren: {
      $id: 'viLink3',
      title: { en: 'sup' },
    },
  })
  await client.set({
    $id: 'viLink4',
    title: { en: 'hi' },
    parents: [],
    children: [],
    lekkerLink: {
      $id: 'viLink5',
      title: { en: 'yo' },
    },
  })

  // TODO
  // Compressed subtrees
  await client.set({
    $id: 'viComp1',
    title: { en: 'hello' },
    children: [
      {
        $id: 'viComp2',
        title: { en: 'hello' },
        children: [
          {
            $id: 'viComp4',
            title: { en: 'hello' },
          },
          {
            $id: 'viComp5',
            title: { en: 'hello' },
          },
        ],
      },
      {
        $id: 'viComp3',
        title: { en: 'hello' },
      },
    ],
  })
  await client.set({
    $id: 'viComp21',
    title: { en: 'hello' },
    children: [
      {
        $id: 'viComp22',
        title: { en: 'hello' },
        children: [
          {
            $id: 'viComp24',
            title: { en: 'hello' },
          },
          {
            $id: 'viComp25',
            title: { en: 'hello' },
          },
        ],
      },
      {
        $id: 'viComp23',
        title: { en: 'hello' },
      },
    ],
  })

  await client.command('hierarchy.compress', ['viComp1'])
  await client.command('hierarchy.compress', ['viComp21'])

  // Compressed subtree on disk
  await client.set({
    $id: 'viDisk1',
    title: { en: 'hello' },
    children: [
      {
        $id: 'viDisk2',
        title: { en: 'hello' },
        children: [
          {
            $id: 'viDisk4',
            title: { en: 'hello' },
          },
          {
            $id: 'viDisk5',
            title: { en: 'hello' },
          },
        ],
      },
      {
        $id: 'viDisk3',
        title: { en: 'hello' },
      },
    ],
  })
  await client.command('hierarchy.compress', [
    'viDisk1',
    hierarchyCompressType.SELVA_HIERARCHY_DETACHED_COMPRESSED_DISK,
  ])

  const compressedFilesBefore = (await readdir(dir)).filter((s) =>
    s.includes('.z')
  )

  await client.command('save', [])
  await wait(1e3)

  const compressedFilesAfter = (await readdir(dir)).filter((s) =>
    s.includes('.z')
  )
  deepEqualIgnoreOrder(
    t,
    compressedFilesAfter,
    compressedFilesBefore,
    'SDB save should not remove the subtree files'
  )

  await restartServer(t)
  await wait(5e3)

  t.deepEqual(
    await client.get({
      $id: 'viTest',
      $all: true,
      parents: true,
      createdAt: false,
      updatedAt: false,
    }),
    {
      id: 'viTest',
      type: 'lekkerType',
      parents: ['root'],
      title: { en: 'hello' },
      stringAry: ['hello', 'world'],
      doubleAry: [1.0, 2.1, 3.2],
      intAry: [7, 6, 5, 4, 0, 3, 2, 999],
      objAry: [
        {
          textyText: {
            en: 'hello 1',
            de: 'hallo 1',
          },
          strField: 'string value hello 1',
          numField: 112,
        },
        {
          textyText: {
            en: 'hello 2',
            de: 'hallo 2',
          },
          strField: 'string value hello 2',
          numField: 113,
        },
        {},
        { strField: 'hello' },
      ],
    }
  )

  t.deepEqual(
    await client.get({
      $id: 'viLink1',
      $all: true,
      createdAt: false,
      updatedAt: false,
      lekkerLink: true,
      fren: true,
    }),
    {
      id: 'viLink1',
      type: 'lekkerType',
      title: { en: 'hi' },
      lekkerLink: 'viLink2',
      fren: 'viLink3',
    }
  )
  t.deepEqual(
    await client.get({
      $id: 'viLink2',
      $all: true,
      createdAt: false,
      updatedAt: false,
      lekkerLink: true,
      fren: true,
    }),
    {
      id: 'viLink2',
      type: 'lekkerType',
      title: { en: 'yo' },
      lekkerLink: 'viLink1',
    }
  )
  t.deepEqual(
    await client.get({
      $id: 'viLink3',
      $all: true,
      createdAt: false,
      updatedAt: false,
      lekkerLink: true,
      fren: true,
    }),
    {
      id: 'viLink3',
      type: 'lekkerType',
      title: { en: 'sup' },
    }
  )
  t.deepEqual(
    await client.get({
      $id: 'viLink4',
      $all: true,
      createdAt: false,
      updatedAt: false,
      lekkerLink: true,
    }),
    {
      id: 'viLink4',
      type: 'lekkerType',
      title: { en: 'hi' },
      lekkerLink: 'viLink5',
    }
  )

  // Check the compressed subtree
  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'viComp1',
      id: true,
      title: true,
      descendants: true,
    }),
    {
      id: 'viComp1',
      title: { en: 'hello' },
      descendants: ['viComp2', 'viComp3', 'viComp4', 'viComp5'],
    }
  )

  // Check the compressed subtree on disk
  // TODO Check that the compressed subtree is actually on the disk
  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'viDisk1',
      id: true,
      title: true,
      descendants: true,
    }),
    {
      id: 'viDisk1',
      title: { en: 'hello' },
      descendants: ['viDisk2', 'viDisk3', 'viDisk4', 'viDisk5'],
    }
  )
  //t.deepEqual((await readdir(dir)).filter((s) => s.includes('.z')), [])

  // Do it again
  await client.command('save', [])
  await wait(1e3)
  await restartServer(t)
  await wait(5e3)

  t.deepEqual(
    await client.get({
      $id: 'viTest',
      $all: true,
      parents: true,
      createdAt: false,
      updatedAt: false,
    }),
    {
      id: 'viTest',
      type: 'lekkerType',
      parents: ['root'],
      title: { en: 'hello' },
      stringAry: ['hello', 'world'],
      doubleAry: [1.0, 2.1, 3.2],
      intAry: [7, 6, 5, 4, 0, 3, 2, 999],
      objAry: [
        {
          textyText: {
            en: 'hello 1',
            de: 'hallo 1',
          },
          strField: 'string value hello 1',
          numField: 112,
        },
        {
          textyText: {
            en: 'hello 2',
            de: 'hallo 2',
          },
          strField: 'string value hello 2',
          numField: 113,
        },
        {},
        { strField: 'hello' },
      ],
    }
  )

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'viLink1',
      $all: true,
      lekkerLink: true,
      fren: true,
    }),
    {
      id: 'viLink1',
      type: 'lekkerType',
      title: { en: 'hi' },
      lekkerLink: 'viLink2',
      fren: 'viLink3',
    }
  )
  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'viLink2',
      $all: true,
      lekkerLink: true,
      fren: true,
    }),
    {
      id: 'viLink2',
      type: 'lekkerType',
      title: { en: 'yo' },
      lekkerLink: 'viLink1',
    }
  )
  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'viLink3',
      $all: true,
      lekkerLink: true,
      fren: true,
    }),
    {
      id: 'viLink3',
      type: 'lekkerType',
      title: { en: 'sup' },
    }
  )

  // Check the previously compressed subtree
  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'viComp1',
      id: true,
      title: true,
      descendants: true,
    }),
    {
      id: 'viComp1',
      title: { en: 'hello' },
      descendants: ['viComp2', 'viComp3', 'viComp4', 'viComp5'],
    }
  )

  // Check the compressed subtree
  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'viComp21',
      id: true,
      title: true,
      descendants: true,
    }),
    {
      id: 'viComp21',
      title: { en: 'hello' },
      descendants: ['viComp22', 'viComp23', 'viComp24', 'viComp25'],
    }
  )
})

test.serial(
  'find - nodeId of a compressed subtree head will restore the compressed subtree',
  async (t) => {
    const { client } = t.context

    await client.set({
      $id: 'ma1',
      title: { de: 'hallo' },
      value: 10,
      description: { en: 'compress me well' },
      children: [
        {
          $id: 'ma2',
          title: { en: 'hello' },
          value: 11,
          description: { en: 'compress me well' },
        },
        {
          $id: 'ma3',
          title: { en: 'hello' },
          value: 12,
          description: { en: 'compress me well' },
        },
      ],
    })

    t.deepEqual(await client.command('hierarchy.compress', ['ma1']), [1n])
    deepEqualIgnoreOrder(t, await client.command('hierarchy.listCompressed'), [
      ['ma1', 'ma2', 'ma3'],
    ])

    t.deepEqual(
      await client.get({
        $id: 'ma1',
        id: true,
        title: true,
        value: true,
        description: true,
        d: {
          $list: {
            $find: {
              $traverse: 'descendants',
            },
          },
          id: true,
          title: true,
          value: true,
          description: true,
        },
      }),
      {
        id: 'ma1',
        title: { de: 'hallo' },
        value: 10,
        description: { en: 'compress me well' },
        d: [
          {
            id: 'ma2',
            title: { en: 'hello' },
            value: 11,
            description: { en: 'compress me well' },
          },
          {
            id: 'ma3',
            title: { en: 'hello' },
            value: 12,
            description: { en: 'compress me well' },
          },
        ],
      }
    )

    t.deepEqual(await client.command('hierarchy.listCompressed'), [[]])
  }
)

test.serial(
  'Get with a nodeId of a compressed node will restore the whole subtree',
  async (t) => {
    const { client } = t.context

    await client.set({
      $id: 'ma1',
      title: { de: 'hallo' },
      value: 10,
      description: { en: 'compress me well' },
      children: [
        {
          $id: 'ma2',
          title: { en: 'hello' },
          value: 11,
          description: { en: 'compress me well' },
        },
        {
          $id: 'ma3',
          title: { en: 'hello' },
          value: 12,
          description: { en: 'compress me well' },
        },
      ],
    })

    t.deepEqual(await client.command('hierarchy.compress', ['ma1']), [1n])
    deepEqualIgnoreOrder(t, await client.command('hierarchy.listCompressed'), [
      ['ma1', 'ma2', 'ma3'],
    ])

    console.log(await client.command('object.get', ['', 'ma3']))
    //t.deepEqual(
    console.log(
      await client.get({
        $id: 'ma2',
        id: true,
        title: true,
        value: true,
        description: true,
      }),
      {
        id: 'ma2',
        title: { en: 'hello' },
        value: 11,
        description: { en: 'compress me well' },
      }
    )

    t.deepEqual(await client.command('hierarchy.listCompressed'), [[]])

    t.deepEqual(
      await client.get({
        $id: 'ma1',
        id: true,
        title: true,
        value: true,
        description: true,
        d: {
          $list: {
            $find: {
              $traverse: 'descendants',
            },
          },
          id: true,
          title: true,
          value: true,
          description: true,
        },
      }),
      {
        id: 'ma1',
        title: { de: 'hallo' },
        value: 10,
        description: { en: 'compress me well' },
        d: [
          {
            id: 'ma2',
            title: { en: 'hello' },
            value: 11,
            description: { en: 'compress me well' },
          },
          {
            id: 'ma3',
            title: { en: 'hello' },
            value: 12,
            description: { en: 'compress me well' },
          },
        ],
      }
    )
  }
)

test.serial(
  'find - traversing root will restore compressed subtree',
  async (t) => {
    const { client } = t.context

    await client.set({
      $id: 'ma1',
      title: { de: 'hallo' },
      value: 10,
      description: { en: 'compress me well' },
      children: [
        {
          $id: 'ma2',
          title: { en: 'hello' },
          value: 11,
          description: { en: 'compress me well' },
        },
        {
          $id: 'ma3',
          title: { en: 'hello' },
          value: 12,
          description: { en: 'compress me well' },
        },
      ],
    })

    t.deepEqual(await client.command('hierarchy.compress', ['ma1']), [1n])
    deepEqualIgnoreOrder(t, await client.command('hierarchy.listCompressed'), [
      ['ma1', 'ma2', 'ma3'],
    ])

    t.deepEqual(
      await client.get({
        $id: 'root',
        d: {
          $list: {
            $find: {
              $traverse: 'descendants',
            },
          },
          id: true,
          title: true,
          value: true,
          description: true,
        },
      }),
      {
        d: [
          {
            description: {
              en: 'compress me well',
            },
            id: 'ma1',
            title: {
              de: 'hallo',
            },
            value: 10,
          },
          {
            description: {
              en: 'compress me well',
            },
            id: 'ma2',
            title: {
              en: 'hello',
            },
            value: 11,
          },
          {
            description: {
              en: 'compress me well',
            },
            id: 'ma3',
            title: {
              en: 'hello',
            },
            value: 12,
          },
        ],
      }
    )

    t.deepEqual(await client.command('hierarchy.listCompressed'), [[]])
  }
)

test.serial('loop in a subtree', async (t) => {
  const { client } = t.context

  await client.set({
    $id: 'ma1',
    title: { de: 'hallo' },
    value: 10,
    description: { en: 'compress me well' },
    children: [
      {
        $id: 'ma2',
        title: { en: 'hello' },
        value: 11,
        description: { en: 'compress me well' },
        children: [
          {
            $id: 'ma3',
            title: { en: 'last' },
          },
        ],
      },
    ],
  })
  await client.set({
    $id: 'ma3',
    children: ['ma1'],
  })

  t.deepEqual(await client.command('hierarchy.compress', ['ma1']), [1n])
})

test.serial('not a proper subtree', async (t) => {
  const { client } = t.context

  await client.set({
    $id: 'ma1',
    title: { de: 'hallo' },
    value: 10,
    description: { en: 'compress me well' },
    children: [
      {
        $id: 'ma2',
        title: { en: 'hello' },
        value: 11,
        description: { en: 'compress me well' },
        children: [
          {
            $id: 'ma3',
            title: { en: 'last' },
          },
        ],
      },
    ],
  })
  await client.set({
    $id: 'ma4',
    children: { $add: ['ma3'] },
  })

  await t.throwsAsync(() => client.command('hierarchy.compress', ['ma1']))
})

test.serial('Compress to disk', async (t) => {
  const { client } = t.context

  await client.set({
    $id: 'ma1',
    title: { de: 'hallo' },
    value: 10,
    description: { en: 'compress me well' },
    children: [
      {
        $id: 'ma2',
        title: { en: 'hello' },
        value: 11,
        description: { en: 'compress me well' },
      },
      {
        $id: 'ma3',
        title: { en: 'hello' },
        value: 12,
        description: { en: 'compress me well' },
      },
    ],
  })

  t.deepEqual(
    await client.command('hierarchy.compress', [
      'ma1',
      hierarchyCompressType.SELVA_HIERARCHY_DETACHED_COMPRESSED_DISK,
    ]),
    [1n]
  )
  deepEqualIgnoreOrder(t, await client.command('hierarchy.listCompressed'), [
    ['ma1', 'ma2', 'ma3'],
  ])

  // TODO Test that we didn't fallback to inmem

  await client.delete({ $id: 'root' })
  deepEqualIgnoreOrder(t, await client.command('hierarchy.listCompressed'), [
    [],
  ])
})

test.serial('Restore from disk', async (t) => {
  const { client } = t.context

  await client.set({
    $id: 'ma1',
    title: { de: 'hallo' },
    value: 10,
    description: { en: 'compress me well' },
    children: [
      {
        $id: 'ma2',
        title: { en: 'hello' },
        value: 11,
        description: { en: 'compress me well' },
      },
      {
        $id: 'ma3',
        title: { en: 'hello' },
        value: 12,
        description: { en: 'compress me well' },
      },
    ],
  })

  t.deepEqual(
    await client.command('hierarchy.compress', [
      'ma1',
      hierarchyCompressType.SELVA_HIERARCHY_DETACHED_COMPRESSED_DISK,
    ]),
    [1n]
  )
  deepEqualIgnoreOrder(t, await client.command('hierarchy.listCompressed'), [
    ['ma1', 'ma2', 'ma3'],
  ])

  // TODO Test that we didn't fallback to inmem

  deepEqualIgnoreOrder(t, await client.get({ $id: 'ma1', $all: true }), {
    description: {
      en: 'compress me well',
    },
    id: 'ma1',
    title: {
      de: 'hallo',
    },
    type: 'match',
    value: 10,
  })
})

test.serial('internal reference in a subtree', async (t) => {
  const { client } = t.context

  await client.set({
    $id: 'ma1',
    title: { de: 'hallo' },
    value: 10,
    description: { en: 'compress me well' },
    children: [
      {
        $id: 'ma2',
        title: { en: 'hello' },
        value: 11,
        description: { en: 'compress me well' },
      },
      {
        $id: 'ma3',
        title: { en: 'hello' },
        value: 12,
        description: { en: 'compress me well' },
      },
    ],
  })
  await client.set({
    $id: 'ma2',
    ref: 'ma3',
  })

  t.deepEqual(await client.command('hierarchy.compress', ['ma1']), [1n])
  deepEqualIgnoreOrder(t, await client.command('hierarchy.listCompressed'), [
    ['ma1', 'ma2', 'ma3'],
  ])

  t.deepEqual(
    await client.get({
      $id: 'ma1',
      id: true,
      title: true,
      value: true,
      description: true,
      d: {
        $list: {
          $find: {
            $traverse: 'descendants',
          },
        },
        id: true,
        title: true,
        value: true,
        description: true,
        ref: true,
      },
    }),
    {
      id: 'ma1',
      title: { de: 'hallo' },
      value: 10,
      description: { en: 'compress me well' },
      d: [
        {
          id: 'ma2',
          ref: 'ma3',
          title: { en: 'hello' },
          value: 11,
          description: { en: 'compress me well' },
        },
        {
          id: 'ma3',
          title: { en: 'hello' },
          value: 12,
          description: { en: 'compress me well' },
        },
      ],
    }
  )

  t.deepEqual(await client.command('hierarchy.listCompressed'), [[]])
})

test.serial('external reference from the subtree', async (t) => {
  const { client } = t.context

  await client.set({
    $id: 'ma1',
    title: { de: 'hallo' },
    value: 10,
    description: { en: 'compress me well' },
    children: [
      {
        $id: 'ma2',
        title: { en: 'hello' },
        value: 11,
        description: { en: 'compress me well' },
      },
      {
        $id: 'ma3',
        title: { en: 'hello' },
        value: 12,
        description: { en: 'compress me well' },
      },
    ],
  })
  await client.set({
    $id: 'ma2',
    ref: 'ma4',
  })

  t.deepEqual(await client.command('hierarchy.compress', ['ma1']), [1n])
  deepEqualIgnoreOrder(t, await client.command('hierarchy.listCompressed'), [
    ['ma1', 'ma2', 'ma3'],
  ])

  t.deepEqual(
    await client.get({
      $id: 'ma1',
      id: true,
      title: true,
      value: true,
      description: true,
      d: {
        $list: {
          $find: {
            $traverse: 'descendants',
          },
        },
        id: true,
        title: true,
        value: true,
        description: true,
        ref: true,
      },
    }),
    {
      id: 'ma1',
      title: { de: 'hallo' },
      value: 10,
      description: { en: 'compress me well' },
      d: [
        {
          id: 'ma2',
          ref: 'ma4',
          title: { en: 'hello' },
          value: 11,
          description: { en: 'compress me well' },
        },
        {
          id: 'ma3',
          title: { en: 'hello' },
          value: 12,
          description: { en: 'compress me well' },
        },
      ],
    }
  )

  t.deepEqual(await client.command('hierarchy.listCompressed'), [[]])
})

test.serial('external reference into the subtree', async (t) => {
  const { client } = t.context

  await client.set({
    $id: 'ma1',
    title: { de: 'hallo' },
    value: 10,
    description: { en: 'compress me well' },
    children: [
      {
        $id: 'ma2',
        title: { en: 'hello' },
        value: 11,
        description: { en: 'compress me well' },
      },
      {
        $id: 'ma3',
        title: { en: 'hello' },
        value: 12,
        description: { en: 'compress me well' },
      },
    ],
  })
  await client.set({
    $id: 'ma4',
    ref: 'ma3',
  })
  t.deepEqual(
    await client.get({
      $id: 'ma4',
      id: true,
      ref: true,
    }),
    {
      id: 'ma4',
      ref: 'ma3',
    }
  )

  t.throwsAsync(() => client.command('hierarchy.compress', ['ma1']))

  t.deepEqual(
    await client.get({
      $id: 'ma1',
      id: true,
      title: true,
      value: true,
      description: true,
      d: {
        $list: {
          $find: {
            $traverse: 'descendants',
          },
        },
        id: true,
        title: true,
        value: true,
        description: true,
        ref: true,
      },
    }),
    {
      id: 'ma1',
      title: { de: 'hallo' },
      value: 10,
      description: { en: 'compress me well' },
      d: [
        {
          id: 'ma2',
          title: { en: 'hello' },
          value: 11,
          description: { en: 'compress me well' },
        },
        {
          id: 'ma3',
          title: { en: 'hello' },
          value: 12,
          description: { en: 'compress me well' },
        },
      ],
    }
  )
  t.deepEqual(
    await client.get({
      $id: 'ma4',
      id: true,
      ref: true,
    }),
    {
      id: 'ma4',
      ref: 'ma3',
    }
  )

  t.deepEqual(await client.command('hierarchy.listCompressed'), [[]])
})
