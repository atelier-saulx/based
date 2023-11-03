import anyTest, { TestInterface } from 'ava'
import { TestCtx, startSubs } from '../assertions'
import { BasedSchemaPartial } from '@based/schema'

const test = anyTest as TestInterface<TestCtx>

const schema: BasedSchemaPartial = {
  language: 'en',
  types: {
    match: {
      prefix: 'ma',
      fields: {
        title: { type: 'text' },
        name: { type: 'string' },
        value: { type: 'number' },
        status: { type: 'number' },
        date: { type: 'number' },
      },
    },
  },
}

// TODO: waiting for error callback
test.serial.skip('subscription validation error', async (t) => {
  await startSubs(t, schema)
  const client = t.context.dbClient
  let errorCnt = 0

  // client
  //   .observe({
  //     $db: {},
  //   })
  //   .subscribe(
  //     () => {},
  //     () => {
  //       // console.log('yesh')
  //       errorCnt++
  //     }
  //   )
  // client.observe({
  //   $db: {},
  // })
  // client.observe({
  //   $db: {},
  // })
  // await wait(2e3)
  // t.is(errorCnt, 1)
  // client.observe({
  //   $db: {},
  // })
  // client
  //   .observe({
  //     $db: {},
  //   })
  //   .subscribe(
  //     () => {},
  //     () => {
  //       errorCnt++
  //     }
  //   )
  // await wait(2e3)
  // t.is(errorCnt, 2)
})

// TODO: waiting for error callback
test.serial.skip(
  'subscription initialization with multiple subscribers',
  async (t) => {
    await startSubs(t, schema)
    const client = t.context.dbClient

    let cnt = 0
    const id = await client.set({
      type: 'match',
      title: { en: 'snurfels' },
    })
    // client
    //   .observe({
    //     $id: id,
    //     title: true,
    //   })
    //   .subscribe(
    //     (v) => {
    //       cnt++
    //     },
    //     () => {
    //       // errorCnt++
    //     }
    //   )
    // await wait(1000)
    // client
    //   .observe({
    //     $id: id,
    //     title: true,
    //   })
    //   .subscribe(
    //     (v) => {
    //       cnt++
    //     },
    //     () => {
    //       // errorCnt++
    //     }
    //   )
    // await wait(1000)
    // t.is(cnt, 2)
    // await client.set({
    //   $id: id,
    //   title: { en: 'snurfels22' },
    // })
    // await wait(1000)
    // t.is(cnt, 4)
  }
)

// TODO: waiting for error callback
test.serial.skip('subscription error on subs manager', async (t) => {
  await startSubs(t, schema)
  const client = t.context.dbClient
  const results = []
  // client
  //   .observe({
  //     $language: 'en',
  //     $id: 'mayuzi',
  //     yizi: {
  //       title: true,
  //       $inherit: {
  //         $item: 'club',
  //       },
  //     },
  //     title: true,
  //   })
  //   .subscribe(
  //     (v) => {
  //       results.push(v)
  //     },
  //     (err) => {
  //       console.error(err)
  //       // errorCnt++
  //     }
  //   )
  // await wait(1000)
  // t.deepEqual(results, [{ $isNull: true }], 'correct isNull on unexisting item')
})
