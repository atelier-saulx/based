import test from 'ava'
import { BasedDbClient } from '../src'
import { startOrigin } from '../../server/dist'
import { SelvaServer } from '../../server/dist/server'
import { wait } from '@saulx/utils'
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
    languages: ['cs', 'en', 'de', 'fi', 'pt'],
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

test.after(async (_t) => {
  await srv.destroy()
  client.destroy()
})

// TODO: waiting for creating node directly when setting children
// only runs on darwin?
// test[process.platform === 'darwin' ? 'skip' : 'serial'](
test.serial.skip('$lang should change the order when relevant', async (t) => {
  await client.set({
    $id: 'match1',
    awayTeam: 'team1',
    homeTeam: 'team2',
    children: [
      {
        $id: 'team1',
        title: {
          cs: 'Öäpelin pallo',
          de: 'Öäpelin pallo',
          en: 'Öäpelin pallo',
          fi: 'Öäpelin pallo',
          gsw: 'Öäpelin pallo',
        },
      },
      {
        $id: 'team2',
        title: {
          cs: 'Aopelin pallo',
          de: 'Aopelin pallo',
          en: 'Aopelin pallo',
          fi: 'Aopelin pallo',
          gsw: 'Aopelin pallo',
        },
      },
      {
        $id: 'team3',
        title: {
          cs: 'OOpelin pallo',
          de: 'OOpelin pallo',
          en: 'Oopelin pallo',
          fi: 'OOpelin pallo',
          gsw: 'OOpelin pallo',
        },
      },
      {
        $id: 'team4',
        title: {
          cs: 'Ääpelin pallo',
          de: 'Ääpelin pallo',
          en: 'Ääpelin pallo',
          fi: 'Ääpelin pallo',
          gsw: 'Ääpelin pallo',
        },
      },
      {
        $id: 'team5',
        title: {
          cs: 'öäpelin pallo',
          de: 'öäpelin pallo',
          en: 'öäpelin pallo',
          fi: 'öäpelin pallo',
          gsw: 'öäpelin pallo',
        },
      },
      {
        $id: 'team6',
        title: {
          cs: 'aopelin pallo',
          de: 'aopelin pallo',
          en: 'aopelin pallo',
          fi: 'aopelin pallo',
          gsw: 'aopelin pallo',
        },
      },
      {
        $id: 'team7',
        title: {
          cs: 'oOpelin pallo',
          de: 'oOpelin pallo',
          en: 'oopelin pallo',
          fi: 'oOpelin pallo',
          gsw: 'oOpelin pallo',
        },
      },
      {
        $id: 'team8',
        title: {
          cs: 'ääpelin pallo',
          de: 'ääpelin pallo',
          en: 'ääpelin pallo',
          fi: 'ääpelin pallo',
          gsw: 'ääpelin pallo',
        },
      },
      {
        $id: 'team9',
        title: {
          cs: 'hrnec pallo',
          de: 'hrnec pallo',
          en: 'hrnec pallo',
          fi: 'hrnec pallo',
          gsw: 'hrnec pallo',
        },
      },
      {
        $id: 'team10',
        title: {
          cs: 'chrt pallo',
          de: 'chrt pallo',
          en: 'chrt pallo',
          fi: 'chrt pallo',
          gsw: 'chrt pallo',
        },
      },
    ],
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
