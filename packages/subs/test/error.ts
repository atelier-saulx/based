import { basicTest } from './assertions/index.js'
// import { subscribe } from '../src/index.js'

const test = basicTest({
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
})

// TODO: waiting for error callback
test.serial.skip('subscription validation error', async (_t) => {
  // const client = t.context.client
  // let errorCnt = 0
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
    const client = t.context.client

    // let cnt = 0
    /* const id = */ await client.set({
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
test.serial.skip('subscription error on subs manager', async (_t) => {
  // const client = t.context.client
  // const results = []
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
