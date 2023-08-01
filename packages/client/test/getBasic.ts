import test from 'ava'
import { BasedDbClient } from '../src'
import { startOrigin } from '../../server/dist'
import { wait } from '@saulx/utils'
import { SelvaServer } from '../../server/dist/server'
import './assertions'

let srv: SelvaServer
let client: BasedDbClient
test.beforeEach(async (t) => {
  console.log('origin')
  srv = await startOrigin({
    port: 8081,
    name: 'default',
  })

  console.log('connecting')
  client = new BasedDbClient()
  client.connect({
    port: 8081,
    host: '127.0.0.1',
  })

  console.log('updating schema')

  await client.updateSchema({
    languages: ['en', 'de', 'nl'],
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
      lekkerType: {
        prefix: 'vi',
        fields: {
          strRec: {
            type: 'record',
            values: {
              type: 'string',
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
                floatArray: { type: 'array', values: { type: 'number' } },
                intArray: { type: 'array', values: { type: 'integer' } },
                objArray: {
                  type: 'array',
                  values: {
                    type: 'object',
                    properties: {
                      hello: { type: 'string' },
                      value: { type: 'integer' },
                      fvalue: { type: 'number' },
                    },
                  },
                },
                hello: {
                  type: 'string',
                },
                nestedRec: {
                  type: 'record',
                  values: {
                    type: 'object',
                    properties: {
                      value: {
                        type: 'number',
                      },
                      hello: {
                        type: 'string',
                      },
                    },
                  },
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
          thing: { type: 'set', items: { type: 'string' } },
          ding: {
            type: 'object',
            properties: {
              dong: { type: 'set', items: { type: 'string' } },
              texty: { type: 'text' },
              dung: { type: 'number' },
              dang: {
                type: 'object',
                properties: {
                  dung: { type: 'number' },
                  dunk: { type: 'string' },
                },
              },
              dunk: {
                type: 'object',
                properties: {
                  ding: { type: 'number' },
                  dong: { type: 'number' },
                },
              },
            },
          },
          dong: { type: 'json' },
          dingdongs: { type: 'array', values: { type: 'string' } },
          floatArray: { type: 'array', values: { type: 'number' } },
          intArray: { type: 'array', values: { type: 'integer' } },
          tsArray: { type: 'array', values: { type: 'timestamp' } },
          refs: { type: 'references' },
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
      club: {
        prefix: 'cl',
        fields: {
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
      match: {
        prefix: 'ma',
        fields: {
          title: { type: 'text' },
          value: { type: 'number' },
          description: { type: 'text' },
        },
      },
      yesno: {
        prefix: 'yn',
        fields: {
          bolYes: { type: 'boolean' },
          bolNo: { type: 'boolean' },
        },
      },
    },
  })
})

test.after(async (t) => {
  await srv.destroy()
  client.destroy()
})

// TODO
test.skip('get null', async (t) => {
  await t.throwsAsync(client.get(null))
})

test.serial('get nested queries', async (t) => {
  await client.set({
    $id: 'maTest',
    value: 11,
    title: { en: 'hello' },
  })

  await client.set({
    $id: 'maTest2',
    value: 12,
    title: { en: 'halloumi' },
  })

  t.deepEqual(
    await client.get({
      $id: 'maTest',
      id: true,
      someItem: {
        $id: 'maTest2',
        title: true,
        nestedThing: { $id: 'maTest', value: true },
      },
      values: [
        {
          $id: 'maTest',
          id: true,
          value: true,
        },
        {
          $id: 'maTest2',
          id: true,
          value: true,
        },
      ],
      title: true,
    }),
    {
      id: 'maTest',
      title: { en: 'hello' },
      someItem: {
        title: {
          en: 'halloumi',
        },
        nestedThing: {
          value: 11,
        },
      },
      values: [
        {
          id: 'maTest',
          value: 11,
        },
        {
          id: 'maTest2',
          value: 12,
        },
      ],
    }
  )
})

test.serial('get boolean value', async (t) => {
  await client.set({
    $id: 'ynTest',
    bolYes: true,
    bolNo: false,
  })

  t.deepEqual(
    await client.get({
      $id: 'ynTest',
      id: true,
      bolYes: true,
      bolNo: true,
    }),
    {
      id: 'ynTest',
      bolYes: true,
      bolNo: false,
    }
  )
})

// TODO: setWalker update
test.serial.skip('get - root', async (t) => {
  const match = await client.set({
    $id: 'maTest',
    value: 11,
  })

  await client.set({
    $id: 'root',
    value: 2555,
  })

  t.deepEqual(
    await client.get({
      $id: 'root',
      id: true,
      value: true,
      children: true,
    }),
    {
      id: 'root',
      value: 2555,
      children: [match],
    }
  )

  t.deepEqual(
    await client.get({
      id: true,
      value: true,
      children: true,
    }),
    {
      id: 'root',
      value: 2555,
      children: [match],
    }
  )

  await client.set({
    $id: 'root',
    nested: { fun: 'yes fun' },
  })

  t.deepEqual(
    await client.get({
      $id: 'root',
      id: true,
      nested: { $all: true },
    }),
    {
      id: 'root',
      nested: { fun: 'yes fun' },
    }
  )
})

test.serial('get - $all simple', async (t) => {
  await client.set({
    $id: 'maA',
    title: {
      en: 'nice!',
    },
    description: {
      en: 'yesh',
    },
  })

  const res = await client.get({
    $id: 'maA',
    $all: true,
    aliases: false,
  })
  delete res.createdAt
  delete res.updatedAt
  t.deepEqual(res, {
    id: 'maA',
    type: 'match',
    title: {
      en: 'nice!',
    },
    description: {
      en: 'yesh',
    },
  })
})

// TODO: * does not take into account specified level of image.thumb, returns image.poster also
test.serial.skip('get - $all root level whitelist + $all', async (t) => {
  await client.set({
    $id: 'clA',
    title: {
      en: 'nice!',
    },
    description: {
      en: 'yesh',
    },
    image: {
      thumb: 'thumb',
      poster: 'poster',
    },
  })

  const res = await client.get({
    $id: 'clA',
    image: {
      thumb: true,
    },
    $all: true,
    aliases: false,
  })
  delete res.createdAt
  delete res.updatedAt
  t.deepEqual(res, {
    id: 'clA',
    type: 'club',
    title: {
      en: 'nice!',
    },
    description: {
      en: 'yesh',
    },
    image: {
      thumb: 'thumb',
    },
  })
})

test.serial('get - $all nested', async (t) => {
  await client.set({
    $id: 'maA',
    title: {
      en: 'nice!',
    },
    description: {
      en: 'yesh',
    },
  })

  t.deepEqual(
    await client.get({
      $id: 'maA',
      id: true,
      title: {
        $all: true,
      },
      description: {
        $all: true,
      },
    }),
    {
      id: 'maA',
      title: {
        en: 'nice!',
      },
      description: {
        en: 'yesh',
      },
    }
  )
})

test.serial('get - $all deeply nested', async (t) => {
  const entry = await client.set({
    type: 'lekkerType',
    title: {
      en: 'nice!',
    },
    ding: {
      dang: {
        dung: 115,
        dunk: '',
      },
    },
  })

  t.deepEqual(
    await client.get({
      $id: entry,
      id: true,
      title: {
        en: true,
      },
      ding: { $all: true },
    }),
    {
      id: entry,
      title: {
        en: 'nice!',
      },
      ding: {
        dang: {
          dung: 115,
          dunk: '',
        },
      },
    }
  )

  t.deepEqual(
    await client.get({
      $id: entry,
      id: true,
      title: {
        en: true,
      },
      ding: { dang: { $all: true } },
    }),
    {
      id: entry,
      title: {
        en: 'nice!',
      },
      ding: {
        dang: {
          dung: 115,
          dunk: '',
        },
      },
    }
  )
})

// TODO: $default
test.serial.skip('get - $default', async (t) => {
  await client.set({
    $id: 'viflap',
    title: { en: 'flap' },
  })

  t.deepEqual(
    await client.get({
      $id: 'viflap',
      age: { $default: 100 },
    }),
    { age: 100 }
  )

  t.deepEqual(
    await client.get({
      $id: 'viflap',
      title: {
        en: { $default: 'untitled' },
        nl: { $default: 'naamloos' },
      },
    }),
    {
      title: { en: 'flap', nl: 'naamloos' },
    }
  )
})

// TODO: $language
test.serial.skip('get - $language', async (t) => {
  await client.set({
    $id: 'viflap',
    title: { en: 'flap', nl: 'flurp' },
    description: { en: 'yes', nl: 'ja' },
  })

  t.deepEqual(
    await client.get({
      $id: 'viflap',
      title: true,
      description: true,
      $language: 'nl',
    }),
    {
      title: 'flurp',
      description: 'ja',
    }
  )

  await client.set({
    $id: 'viflurx',
    title: { en: 'flap', nl: 'flurp' },
  })

  t.deepEqual(
    await client.get({
      $id: 'viflurx',
      $language: 'nl',
      description: { $default: 'flurpy' },
    }),
    { description: 'flurpy' }
  )
})

// TODO: we should return empty arrays by default?
test.serial.skip('get - field with empty array', async (t) => {
  const id = await client.set({
    type: 'lekkerType',
    thing: [],
    dong: { dingdong: [] },
    ding: { dong: [] },
    dingdongs: [],
    refs: [],
  })

  const result = await client.get({
    $id: id,
    thing: true,
    dong: true,
    ding: { dong: true },
    dingdongs: true,
    children: true,
    descendants: true,
    refs: true,
  })

  t.deepEqual(result, {
    children: [],
    descendants: [],
    dong: { dingdong: [] },
    refs: [],
  })

  t.deepEqual(
    await client.get({
      $id: id,
      $all: true,
    }),
    {
      id,
      dong: { dingdong: [] },
      type: 'lekkerType',
    }
  )
})

// TODO: we should return empty arrays by default?
test.serial.skip('get - references', async (t) => {
  const id1 = await client.set({
    type: 'lekkerType',
    value: 1,
  })
  const id11 = await client.set({
    type: 'lekkerType',
    value: 11,
  })
  const id2 = await client.set({
    type: 'lekkerType',
    refs: [id1, id11],
    value: 2,
  })

  const result = await client.get({
    $id: id2,
    children: true,
    descendants: true,
    refs: true,
  })

  t.deepEqual(result, {
    children: [],
    descendants: [],
    refs: [id1, id11],
  })

  t.deepEqual(
    await client.get({
      $id: id2,
      $all: true,
    }),
    {
      id: id2,
      type: 'lekkerType',
      // this should no longer work (we don't return ref/refs types with $all by default
      // refs: [id1, id11],
    }
  )
})

test.serial('get - set with some items', async (t) => {
  const id = await client.set({
    type: 'lekkerType',
    thing: ['a', 'b'],
  })

  const result = await client.get({
    $id: id,
    thing: true,
  })

  t.deepEqual(result, {
    thing: ['a', 'b'],
  })
})

// TODO: `descendants: true` returns undefined, not the actual array
test.serial.skip('get - hierarchy', async (t) => {
  await Promise.all([
    await client.set({
      $id: 'viflo',
      value: 1,
    }),
    await client.set({
      $id: 'maflux',
      value: 2,
    }),
  ])
  await client.set({
    $id: 'vifla',
    children: ['viflo', 'maflux'],
  })
  await client.set({
    $id: 'viflapx',
    children: ['vifla', 'viflo'],
  })

  t.deepEqualIgnoreOrder(
    await client.get({
      $id: 'viflapx',
      descendants: true,
      children: true,
      parents: true,
    }),
    {
      descendants: ['viflo', 'vifla', 'maflux'],
      children: ['viflo', 'vifla'],
      parents: ['root'],
    }
  )

  t.deepEqual(
    await client.get({
      $id: 'maflux',
      ancestors: true,
    }),
    {
      ancestors: ['root', 'vifla', 'viflapx'],
    }
  )
})
