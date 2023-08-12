import anyTest, { TestInterface } from 'ava'
import { BasedDbClient } from '../src'
import { startOrigin } from '../../server/dist'
import { SelvaServer } from '../../server/dist/server'
import { wait } from '@saulx/utils'
import './assertions'
import getPort from 'get-port'

const test = anyTest as TestInterface<{
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
    languages: ['en', 'de', 'nl', 'it'],
    types: {
      league: {
        prefix: 'le',
        fields: {
          title: { type: 'text' },
          name: { type: 'string' },
          value: { type: 'number' },
        },
      },
      match: {
        prefix: 'ma',
        fields: {
          title: { type: 'text' },
          name: { type: 'string' },
          value: { type: 'number' },
        },
      },
      ticket: {
        prefix: 'tk',
        fields: {
          title: { type: 'text' },
          name: { type: 'string' },
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

test('find fields with a substring match', async (t) => {
  const { client } = t.context
  await Promise.all(
    [
      {
        type: 'ticket',
        title: { en: 'Game One' },
        name: 'Amanpreet Bennett',
      },
      {
        type: 'ticket',
        title: { en: 'Game One' },
        name: 'Ozan Weston',
      },
      {
        type: 'ticket',
        title: { en: 'Game One' },
        name: 'Alejandro Hackett',
      },
      {
        type: 'ticket',
        title: { en: 'Game Two' },
        name: 'Dane Bray',
      },
      {
        type: 'ticket',
        title: { en: 'Game One' },
        name: 'Lyndsey Hackett',
      },
      {
        type: 'ticket',
        title: { en: 'Game One' },
        name: 'Chandler Hackett',
      },
      {
        type: 'ticket',
        title: { en: 'Game Two' },
        name: 'Harold Pate',
      },
      {
        type: 'ticket',
        title: { en: 'Game One' },
        name: 'Stella Cisneros',
      },
      {
        type: 'ticket',
        title: { en: 'Game Two' },
        name: 'Norman Hackett',
      },
      {
        type: 'ticket',
        title: { en: 'Game One' },
        name: 'Rikesh Frey',
      },
    ].map((v) => client.set(v))
  )

  const r = await client.get({
    descendants: {
      title: true,
      name: true,
      $list: {
        $sort: { $field: 'name', $order: 'asc' },
        $find: {
          $filter: [
            {
              $operator: 'includes',
              $field: 'name',
              $value: 'Hackett',
            },
          ],
        },
      },
    },
  })
  t.deepEqual(r, {
    descendants: [
      {
        title: { en: 'Game One' },
        name: 'Alejandro Hackett',
      },
      {
        title: { en: 'Game One' },
        name: 'Chandler Hackett',
      },
      {
        title: { en: 'Game One' },
        name: 'Lyndsey Hackett',
      },
      {
        title: { en: 'Game Two' },
        name: 'Norman Hackett',
      },
    ],
  })

  t.deepEqual(
    await client.get({
      $language: 'en',
      descendants: {
        title: true,
        name: true,
        $list: {
          $sort: { $field: 'name', $order: 'asc' },
          $find: {
            $filter: [
              {
                $operator: 'includes',
                $field: 'title',
                $value: 'One',
              },
            ],
          },
        },
      },
    }),
    {
      descendants: [
        {
          name: 'Alejandro Hackett',
          title: 'Game One',
        },
        {
          name: 'Amanpreet Bennett',
          title: 'Game One',
        },
        {
          name: 'Chandler Hackett',
          title: 'Game One',
        },
        {
          name: 'Lyndsey Hackett',
          title: 'Game One',
        },
        {
          name: 'Ozan Weston',
          title: 'Game One',
        },
        {
          name: 'Rikesh Frey',
          title: 'Game One',
        },
        {
          name: 'Stella Cisneros',
          title: 'Game One',
        },
      ],
    }
  )

  t.deepEqual(
    await client.get({
      $language: 'en',
      descendants: {
        title: true,
        name: true,
        $list: {
          $sort: { $field: 'name', $order: 'asc' },
          $find: {
            $filter: [
              {
                $operator: 'includes',
                $field: 'title',
                $value: 'On',
              },
            ],
          },
        },
      },
    }),
    {
      descendants: [
        {
          name: 'Alejandro Hackett',
          title: 'Game One',
        },
        {
          name: 'Amanpreet Bennett',
          title: 'Game One',
        },
        {
          name: 'Chandler Hackett',
          title: 'Game One',
        },
        {
          name: 'Lyndsey Hackett',
          title: 'Game One',
        },
        {
          name: 'Ozan Weston',
          title: 'Game One',
        },
        {
          name: 'Rikesh Frey',
          title: 'Game One',
        },
        {
          name: 'Stella Cisneros',
          title: 'Game One',
        },
      ],
    }
  )
})
