import anyTest, { TestFn } from 'ava'
import { BasedDbClient } from '../src/index.js'
import { startOrigin, SelvaServer } from '@based/db-server'
import './assertions/index.js'
import getPort from 'get-port'
import { deepEqualIgnoreOrder } from './assertions/index.js'

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

  console.log('updating schema')

  await t.context.client.updateSchema({
    language: 'en',
    root: {
      fields: {
        friends: {
          type: 'record',
          values: { type: 'reference' },
        },
        groups: {
          type: 'record',
          values: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              members: { type: 'references' },
            },
          },
        },
        info: {
          type: 'record',
          values: {
            type: 'object',
            properties: {
              kind: { type: 'string' },
              ref: { type: 'reference' },
            },
          },
        },
      },
    },
    types: {
      friend: {
        prefix: 'fr',
        fields: {
          name: { type: 'string' },
        },
      },
    },
  })
})

test.afterEach.always(async (t) => {
  const { srv, client } = t.context
  await srv.destroy()
  client.destroy()
})

test('references in a record', async (t) => {
  const { client } = t.context
  const fr1 = await client.set({
    type: 'friend',
    name: 'Cohen Gilliam',
  })
  const fr2 = await client.set({
    type: 'friend',
    name: 'Mohamad Bentley',
  })
  const fr3 = await client.set({
    type: 'friend',
    name: 'Letitia Fitzgerald',
  })

  await client.set({
    $id: 'root',
    friends: {
      cohen: fr1,
      maometto: fr2,
      fitz: fr3,
    },
  })

  t.deepEqual(
    await client.get({
      $id: 'root',
      friends: true,
    }),
    {
      friends: {
        cohen: fr1,
        maometto: fr2,
        fitz: fr3,
      },
    }
  )
})

test('object record with references', async (t) => {
  const { client } = t.context
  const fr1 = await client.set({
    type: 'friend',
    name: 'Cohen Gilliam',
  })
  const fr2 = await client.set({
    type: 'friend',
    name: 'Mohamad Bentley',
  })
  const fr3 = await client.set({
    type: 'friend',
    name: 'Letitia Fitzgerald',
  })

  await client.set({
    $id: 'root',
    groups: {
      a: {
        name: 'best friends',
        members: [fr1, fr2],
      },
      b: {
        name: 'worst friends',
        members: [fr3],
      },
      c: {
        name: 'empty',
      },
    },
  })

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'root',
      groups: true,
    }),
    {
      groups: {
        a: {
          name: 'best friends',
          members: [fr1, fr2],
        },
        b: {
          name: 'worst friends',
          members: [fr3],
        },
        c: {
          name: 'empty',
        },
      },
    }
  )

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'root',
      groups: {
        '*': { name: true },
      },
    }),
    {
      groups: {
        a: {
          name: 'best friends',
        },
        b: {
          name: 'worst friends',
        },
        c: {
          name: 'empty',
        },
      },
    }
  )

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'root',
      groups: {
        '*': { members: true },
      },
    }),
    {
      groups: {
        a: {
          members: [fr1, fr2],
        },
        b: {
          members: [fr3],
        },
      },
    }
  )
})

// TODO: references not working
test.skip('single references in an object record', async (t) => {
  const { client } = t.context
  const fr1 = await client.set({
    type: 'friend',
    name: 'Cohen Gilliam',
  })
  const fr2 = await client.set({
    type: 'friend',
    name: 'Mohamad Bentley',
  })
  const fr3 = await client.set({
    type: 'friend',
    name: 'Letitia Fitzgerald',
  })

  await client.set({
    $id: 'root',
    info: {
      cohen: {
        kind: 'good',
        ref: fr1,
      },
      maometto: {
        kind: 'bad',
        ref: fr2,
      },
      fitz: {
        kind: 'best',
        ref: fr3,
      },
    },
  })

  t.deepEqual(
    await client.get({
      $id: 'root',
      info: true,
    }),
    {
      info: {
        cohen: {
          kind: 'good',
          ref: fr1,
        },
        maometto: {
          kind: 'bad',
          ref: fr2,
        },
        fitz: {
          kind: 'best',
          ref: fr3,
        },
      },
    }
  )

  t.deepEqual(
    await client.get({
      $id: 'root',
      info: {
        '*': {
          ref: true,
        },
      },
    }),
    {
      info: {
        cohen: {
          ref: fr1,
        },
        maometto: {
          ref: fr2,
        },
        fitz: {
          ref: fr3,
        },
      },
    }
  )

  t.deepEqual(
    await client.get({
      $id: 'root',
      info: {
        '*': {
          kind: true,
        },
      },
    }),
    {
      info: {
        cohen: {
          kind: 'good',
        },
        maometto: {
          kind: 'bad',
        },
        fitz: {
          kind: 'best',
        },
      },
    }
  )

  t.deepEqual(
    await client.get({
      $id: 'root',
      info: {
        '*': {
          kind: true,
          ref: true,
        },
      },
    }),
    {
      info: {
        cohen: {
          kind: 'good',
          ref: fr1,
        },
        maometto: {
          kind: 'bad',
          ref: fr2,
        },
        fitz: {
          kind: 'best',
          ref: fr3,
        },
      },
    }
  )

  t.deepEqual(
    await client.get({
      $id: 'root',
      info: {
        '*': {
          kind: true,
          ref: { name: true },
        },
      },
    }),
    {
      info: {
        cohen: {
          kind: 'good',
          ref: { name: 'Cohen Gilliam' },
        },
        maometto: {
          kind: 'bad',
          ref: { name: 'Mohamad Bentley' },
        },
        fitz: {
          kind: 'best',
          ref: { name: 'Letitia Fitzgerald' },
        },
      },
    }
  )
})
