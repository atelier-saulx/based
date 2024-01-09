import { basicTest } from './assertions/index.js'
// import { subscribe } from '../src/index.js'
import { wait } from '@saulx/utils'

const test = basicTest({
  language: 'en',
  types: {
    match: {
      prefix: 'ma',
      fields: {
        value: { type: 'number' },
      },
    },
  },
})

// const observe = async (
//   t: ExecutionContext<TestCtx>,
//   q: any,
//   cb: (d: any) => void
// ) => {
//   const { subClient } = t.context
//   const id = subClient.subscribe('db', q, cb)
//   return id
// }

test.serial.skip('verify missing markers', async (t) => {
  const client = t.context.client

  //let res: any
  //observe(
  //  t,
  //  {
  //    $id: 'ma1',
  //    id: true,
  //    value: true,
  //  },
  //  (v) => {
  //    res = v
  //  }
  //)

  // TODO Remove
  await client.command('resolve.nodeid', [1, 'ma1'])

  await wait(200)
  const mMarkersBefore = await client.command('subscriptions.list', 2)
  console.log('missingMarkersBefore:', mMarkersBefore)
  console.log(
    await client.command('modify', ['ma1', '', ['0', 'field', 'hello']])
  )
  //await client.set({
  //  $id: 'ma1',
  //  type: 'match',
  //  //value: 5, TODO crash
  //})
  await wait(200)
  const mMarkersAfter = await client.command('subscriptions.list', 2)
  console.log('missingMarkersAfter:', mMarkersAfter)

  // TODO
  //t.deepEqual(res, { id: 'ma1', value: 5 })
  console.log(await client.get({ $id: 'ma1', id: true, value: true }))
  console.log(await client.command('object.get', ['', 'ma1']))
})
