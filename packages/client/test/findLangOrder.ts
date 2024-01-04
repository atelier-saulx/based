import anyTest, { TestFn } from 'ava'
import { BasedDbClient } from '../src'
import { startOrigin } from '../../server/dist'
import { SelvaServer } from '../../server/dist/server'
import './assertions'
import getPort from 'get-port'

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
    language: 'cs',
    translations: ['en', 'de', 'fi', 'pt'],
    types: {
      match: {
        prefix: 'ma',
        fields: {
          awayTeam: { type: 'reference' },
          homeTeam: { type: 'reference' },
        },
      },
      team: {
        prefix: 'te',
        fields: {
          title: {
            type: 'text',
          },
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

// only runs on darwin?
// test[process.platform === 'darwin' ? 'skip' : 'serial'](
test.skip('$lang should change the order when relevant', async (t) => {
  const { client } = t.context
  const children = await Promise.all(
    [
      {
        $id: 'team1',
        parents: ['match1'],
        title: {
          cs: 'Öäpelin pallo',
          de: 'Öäpelin pallo',
          en: 'Öäpelin pallo',
          fi: 'Öäpelin pallo',
          pt: 'Öäpelin pallo',
        },
      },
      {
        $id: 'team2',
        parents: ['match1'],
        title: {
          cs: 'Aopelin pallo',
          de: 'Aopelin pallo',
          en: 'Aopelin pallo',
          fi: 'Aopelin pallo',
          pt: 'Aopelin pallo',
        },
      },
      {
        $id: 'team3',
        parents: ['match1'],
        title: {
          cs: 'OOpelin pallo',
          de: 'OOpelin pallo',
          en: 'Oopelin pallo',
          fi: 'OOpelin pallo',
          pt: 'OOpelin pallo',
        },
      },
      {
        $id: 'team4',
        parents: ['match1'],
        title: {
          cs: 'Ääpelin pallo',
          de: 'Ääpelin pallo',
          en: 'Ääpelin pallo',
          fi: 'Ääpelin pallo',
          pt: 'Ääpelin pallo',
        },
      },
      {
        $id: 'team5',
        parents: ['match1'],
        title: {
          cs: 'öäpelin pallo',
          de: 'öäpelin pallo',
          en: 'öäpelin pallo',
          fi: 'öäpelin pallo',
          pt: 'öäpelin pallo',
        },
      },
      {
        $id: 'team6',
        parents: ['match1'],
        title: {
          cs: 'aopelin pallo',
          de: 'aopelin pallo',
          en: 'aopelin pallo',
          fi: 'aopelin pallo',
          pt: 'aopelin pallo',
        },
      },
      {
        $id: 'team7',
        parents: ['match1'],
        title: {
          cs: 'oOpelin pallo',
          de: 'oOpelin pallo',
          en: 'oopelin pallo',
          fi: 'oOpelin pallo',
          pt: 'oOpelin pallo',
        },
      },
      {
        $id: 'team8',
        parents: ['match1'],
        title: {
          cs: 'ääpelin pallo',
          de: 'ääpelin pallo',
          en: 'ääpelin pallo',
          fi: 'ääpelin pallo',
          pt: 'ääpelin pallo',
        },
      },
      {
        $id: 'team9',
        parents: ['match1'],
        title: {
          cs: 'hrnec pallo',
          de: 'hrnec pallo',
          en: 'hrnec pallo',
          fi: 'hrnec pallo',
          pt: 'hrnec pallo',
        },
      },
      {
        $id: 'team10',
        parents: ['match1'],
        title: {
          cs: 'chrt pallo',
          de: 'chrt pallo',
          en: 'chrt pallo',
          fi: 'chrt pallo',
          pt: 'chrt pallo',
        },
      },
    ].map((s) => client.set(s))
  )
  await client.set({
    $id: 'match1',
    awayTeam: 'team1',
    homeTeam: 'team2',
    children,
  })

  t.deepEqual(
    await client.get({
      $language: 'en',
      $id: 'match1',
      children: {
        id: true,
        $list: {
          $sort: { $field: 'title', $order: 'asc' },
          $find: {
            $traverse: 'descendants',
          },
        },
      },
    }),
    {
      children: [
        { id: 'team8' },
        { id: 'team4' },
        { id: 'team6' },
        { id: 'team2' },
        { id: 'team10' },
        { id: 'team9' },
        { id: 'team5' },
        { id: 'team1' },
        { id: 'team7' },
        { id: 'team3' },
      ],
    }
  )

  t.deepEqual(
    await client.get({
      $language: 'de',
      $id: 'match1',
      children: {
        id: true,
        $list: {
          $sort: { $field: 'title', $order: 'asc' },
          $find: {
            $traverse: 'descendants',
          },
        },
      },
    }),
    {
      children: [
        { id: 'team8' },
        { id: 'team4' },
        { id: 'team6' },
        { id: 'team2' },
        { id: 'team10' },
        { id: 'team9' },
        { id: 'team5' },
        { id: 'team1' },
        { id: 'team7' },
        { id: 'team3' },
      ],
    }
  )

  t.deepEqual(
    await client.get({
      $language: 'fi',
      $id: 'match1',
      children: {
        id: true,
        $list: {
          $sort: { $field: 'title', $order: 'asc' },
          $find: {
            $traverse: 'descendants',
          },
        },
      },
    }),
    {
      children: [
        { id: 'team6' },
        { id: 'team2' },
        { id: 'team10' },
        { id: 'team9' },
        { id: 'team7' },
        { id: 'team3' },
        { id: 'team8' },
        { id: 'team4' },
        { id: 'team5' },
        { id: 'team1' },
      ],
    }
  )

  t.deepEqual(
    await client.get({
      $language: 'cs',
      $id: 'match1',
      children: {
        id: true,
        $list: {
          $sort: { $field: 'title', $order: 'asc' },
          $find: {
            $traverse: 'descendants',
          },
        },
      },
    }),
    {
      children: [
        { id: 'team8' },
        { id: 'team4' },
        { id: 'team6' },
        { id: 'team2' },
        { id: 'team9' },
        { id: 'team10' },
        { id: 'team5' },
        { id: 'team1' },
        { id: 'team7' },
        { id: 'team3' },
      ],
    }
  )

  t.deepEqual(
    await client.get({
      $language: 'gsw',
      $id: 'match1',
      children: {
        id: true,
        $list: {
          $sort: { $field: 'title', $order: 'asc' },
          $find: {
            $traverse: 'descendants',
          },
        },
      },
    }),
    {
      children: [
        { id: 'team8' },
        { id: 'team4' },
        { id: 'team6' },
        { id: 'team2' },
        { id: 'team10' },
        { id: 'team9' },
        { id: 'team5' },
        { id: 'team1' },
        { id: 'team7' },
        { id: 'team3' },
      ],
    }
  )
})
