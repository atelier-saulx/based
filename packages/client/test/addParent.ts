import test from 'ava'
import { BasedDbClient } from '../src'
import { startOrigin } from '../../server/dist'
import { SelvaServer } from '../../server/dist/server'
import { wait } from '@saulx/utils'
import './assertions'

let srv: SelvaServer
let client: BasedDbClient
const port = 8081
test.beforeEach(async (t) => {
  console.log('origin')
  srv = await startOrigin({
    port,
    name: 'default',
  })

  console.log('connecting')
  client = new BasedDbClient()
  client.connect({
    port,
    host: '127.0.0.1',
  })
})

test.afterEach(async (_t) => {
  await srv.destroy()
  client.destroy()
  await wait(300)
})

// TODO: parents: { $add } not working
test.serial.skip(
  'when using parents.$add empty, root should still be added in ancestors (low prio)',
  async (t) => {
    await client.updateSchema({
      types: {
        sport: {
          prefix: 'sp',
        },
      },
    })

    await client.set({
      type: 'sport',
      $id: 'sp11',
      parents: {
        $add: [],
      },
    })

    t.deepEqualIgnoreOrder(await client.get({ $id: 'sp11', ancestors: true }), {
      ancestors: ['root'],
    })
  }
)

// @rase~ This test was commented. Is it relevant?
//
//
// test.serial(
//   'ancestors of descendants are updated correct after parent is removed (high prio)',
//   async t => {
//     const client = connect({ port }, { loglevel: 'info' })
//
//     await client.updateSchema({
//       types: {
//         sport: {
//           prefix: 'sp'
//         }
//       }
//     })
//
//     await client.set({
//       type: 'sport',
//       $id: 'sp1'
//     })
//
//     await client.set({
//       type: 'sport',
//       $id: 'sp2',
//       parents: {
//         $add: ['sp1']
//       }
//     })
//
//     t.deepEqualIgnoreOrder(await client.get({ $id: 'sp2', ancestors: true }), {
//       ancestors: ['root', 'sp1']
//     })
//
//     await client.delete({
//       $id: 'sp1'
//     })
//
//     t.deepEqualIgnoreOrder(await client.get({ $id: 'sp2', ancestors: true }), {
//       ancestors: ['root']
//     })
//   }
// )
// test.serial(
//   'ancestors of descendants are updated correct after parent is removed (high prio)',
//   async t => {
//     const client = connect({ port }, { loglevel: 'info' })
//
//     await client.updateSchema({
//       types: {
//         sport: {
//           prefix: 'sp'
//         }
//       }
//     })
//
//     await client.set({
//       type: 'sport',
//       $id: 'sp1'
//     })
//
//     await client.set({
//       type: 'sport',
//       $id: 'sp2',
//       parents: {
//         $add: ['sp1']
//       }
//     })
//
//     t.deepEqualIgnoreOrder(await client.get({ $id: 'sp2', ancestors: true }), {
//       ancestors: ['root', 'sp1']
//     })
//
//     await client.delete({
//       $id: 'sp1'
//     })
//
//     t.deepEqualIgnoreOrder(await client.get({ $id: 'sp2', ancestors: true }), {
//       ancestors: ['root']
//     })
//   }
// )
