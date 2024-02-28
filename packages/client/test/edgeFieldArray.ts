import anyTest, { TestFn } from 'ava'
import { BasedDbClient, protocol } from '../src/index.js'
import { startOrigin, SelvaServer } from '@based/db-server'
import './assertions/index.js'
import getPort from 'get-port'
import { find } from './assertions/utils.js'
import { SelvaTraversal } from '../src/protocol/index.js'
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
    types: {
      game: {
        prefix: 'ga',
        fields: {
          title: { type: 'string' },
          players: {
            type: 'references',
            bidirectional: { fromField: 'game' },
            allowedTypes: [ 'player' ],
            sortable: true,
          },
        },
      },
      player: {
        prefix: 'pl',
        fields: {
          name: { type: 'string' },
          game: {
            type: 'reference',
            bidirectional: { fromField: 'players' },
            allowedTypes: [ 'game' ],
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

test('edge array ops', async (t) => {
  const { client } = t.context

  const player1 = await client.set({
    $id: 'pl1',
    name: 'm1ke',
  })
  const player2 = await client.set({
    $id: 'pl2',
    name: 'jo3',
  })
  const player3 = await client.set({
    $id: 'pl3',
    name: 'doug',
  })
  const player4 = await client.set({
    $id: 'pl4',
    name: 'doug',
  })
  const game = await client.set({
    type: 'game',
    title: 'Best Game',
    players: [
      player2,
      player1,
      player3,
    ],
  })
  t.deepEqual(await client.get({
    $id: game,
    players: true,
  }), {
    players: [player2, player1, player3],
  })

  await client.set({
    $id: game,
    players: { $add: player4 }
  })
  t.deepEqual(await client.get({
    $id: game,
    players: true,
  }), {
    players: [player2, player1, player3, player4],
  })

  await client.set({
    $id: game,
    players: { $remove: player3 },
  })
  t.deepEqual(await client.get({
    $id: game,
    players: true,
  }), {
    players: [player2, player1, player4],
  })

  await client.set({
    $id: game,
    players: [
      player4,
      player3,
      player2,
      player1,
    ],
  })
  t.deepEqual(await client.get({
    $id: game,
    players: true,
  }), {
    players: [player4, player3, player2, player1],
  })
})
