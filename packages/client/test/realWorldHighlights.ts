import anyTest, { TestFn } from 'ava'
import { BasedDbClient } from '../src/index.js'
import { startOrigin } from '@based/db-server'
import './assertions'
import getPort from 'get-port'
import { SelvaServer } from '@based/db-server'
import { deepEqualIgnoreOrder } from './assertions/index.js'

const test = anyTest as TestFn<{
  srv: SelvaServer
  client: BasedDbClient
  port: number
}>

test.beforeEach(async (t) => {
  t.context.port = await getPort()
  t.context.srv = await startOrigin({
    port: t.context.port,
    name: 'default',
  })
  t.context.client = new BasedDbClient()
  t.context.client.connect({ port: t.context.port, host: '127.0.0.1' })

  const theme = {
    type: 'object',
    properties: {
      colors: {
        type: 'object',
        properties: {
          blue: { type: 'string' },
        },
      },
    },
  }

  const components: any = {
    type: 'record',
    values: {
      type: 'object',
      properties: {
        component: { type: 'string' },
        name: { type: 'string' },
        index: { type: 'integer' },
        text: { type: 'text' },
        color: { type: 'string' },
        image: { type: 'string' },
        font: { type: 'string' },
        fontSize: { type: 'number' },
        inputType: { type: 'string' },

        items: {
          type: 'record',
          values: {
            type: 'object',
            properties: {
              image: { type: 'string' },
              title: {
                type: 'object',
                properties: {
                  text: { type: 'text' },
                },
              },
              subtitle: {
                type: 'object',
                properties: {
                  text: { type: 'text' },
                },
              },
              info: {
                type: 'object',
                properties: {
                  text: { type: 'text' },
                  to: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  }

  await t.context.client.updateSchema({
    language: 'en',
    translations: ['de'],
    root: {
      fields: {
        // @ts-ignore
        theme,
      },
    },
    types: {
      sport: {
        prefix: 'sp',
        fields: {
          title: {
            type: 'text',
          },
        },
      },
      category: {
        prefix: 'ca',
        fields: {
          name: { type: 'string' },
          title: {
            type: 'text',
          },
        },
      },
      match: {
        prefix: 'ma',
        fields: {
          title: {
            type: 'text',
          },
          published: {
            type: 'boolean',
          },
        },
      },
      pageTemplate: {
        prefix: 'pt',
        fields: {
          name: { type: 'string' }, // of you want a custom name
          components,
        },
      },
    },
  })
})

test.afterEach.always(async (t) => {
  const { srv, client } = t.context
  client.destroy()
  await srv.destroy()
})

test('real world highlights', async (t) => {
  const { client } = t.context
  await client.set({
    $language: 'en',
    $id: 'sp1',
    title: 'sport nice',
    children: await Promise.all(
      [
        {
          $language: 'en',
          $id: 'ca1',
          title: 'Highlights',
          name: 'highlights',
          children: await Promise.all(
            [
              {
                $id: 'ma1',
                $language: 'en',
                title: 'match 1',
                published: true,
              },
              {
                $id: 'ma2',
                $language: 'en',
                title: 'match 2',
                published: true,
              },
              {
                $id: 'ma3',
                $language: 'en',
                title: 'match 3',
                published: false,
              },
            ].map((b) => client.set(b))
          ),
        },
      ].map((b) => client.set(b))
    ),
  })

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'sp1',
      $language: 'en',
      component: {
        $value: 'Highlights',
      },
      children: {
        type: true,
        title: true,
        id: true,
        $list: {
          $find: {
            $traverse: 'children',
            $find: {
              $traverse: 'children',
              $filter: [
                {
                  $field: 'published',
                  $operator: '=',
                  $value: true,
                },
              ],
            },
            $filter: [
              {
                $value: 'category',
                $field: 'type',
                $operator: '=',
              },
              {
                $value: 'highlights',
                $field: 'name',
                $operator: '=',
              },
            ],
          },
          $limit: 3,
        },
        date: true,
        video: true,
      },
      title: {
        $value: 'Bla bla',
      },
    }),
    {
      component: 'Highlights',
      title: 'Bla bla',
      children: [
        { id: 'ma1', type: 'match', title: 'match 1' },
        { id: 'ma2', type: 'match', title: 'match 2' },
      ],
    }
  )
  t.pass()
})

test('nested wildcard query for records', async (t) => {
  const { client } = t.context
  await client.set({
    $id: 'pt1',
    $language: 'en',
    name: 'Special Page Template',
    components: {
      0: {
        component: 'Text',
        name: 'Random Text',
        text: 'Voting round 1?',
        color: '#0750C6',
      },
      1: {
        component: 'Image',
        image:
          'https://i1.wp.com/psych2go.net/wp-content/uploads/2014/08/91df642880432da28c563dfc45fa57f5.jpg?fit=640%2C400&ssl=1',
      },
      2: {
        component: 'List',
        items: {
          0: {
            title: {
              text: 'Efendi',
            },
            image:
              'https://i1.wp.com/psych2go.net/wp-content/uploads/2014/08/91df642880432da28c563dfc45fa57f5.jpg?fit=640%2C400&ssl=1',
          },
        },
      },
    },
  })

  await client.get({
    $id: 'pt1',
    $language: 'en',
    id: true,
    components: {
      '*': {
        items: {
          0: true,
        },
      },
    },
  })

  t.pass()
})
