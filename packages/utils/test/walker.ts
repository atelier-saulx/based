import test from 'ava'
import { walk } from '../src/index.js'

const stub = {
  a: 'a',
  b: {
    c: 'c',
    d: 'd',
    e: {
      f: 'f',
      g: 1,
      h: true,
    },
    i: false,
    j: [1, 2, 3],
    k: {
      l: [{ m: true, n: false }, { o: true }],
    },
    p: null,
  },
}

test.serial('walker should walk objects', async (t) => {
  const result: any[] = []
  const start = performance.now()
  await walk(stub, async (item, info) => {
    result.push({ path: info.path, value: item })
  })
  const end = performance.now()
  t.log(`amount: ${result.length}, millis: ${end - start}`)
  const nonNestedItemsCount = result.length
  t.is(nonNestedItemsCount, 10)
  t.deepEqual(
    result.find((r) => r.path === 'a'),
    { path: 'a', value: 'a' }
  )
  t.true(Array.isArray(result.find((r) => r.path === 'b/k/l').value))
})

test.serial('walker should handle undefined and void objects', async (t) => {
  let matchCounter = 0
  await walk(undefined, async () => {
    matchCounter++
  })
  t.is(matchCounter, 0)
  await walk(null, async () => {
    matchCounter++
  })
  t.is(matchCounter, 0)
  await walk({}, async () => {
    matchCounter++
  })
  t.is(matchCounter, 0)
  await walk([], async () => {
    matchCounter++
  })
  t.is(matchCounter, 0)
  await walk('', async () => {
    matchCounter++
  })
  t.is(matchCounter, 0)
  await walk('this is a string', async () => {
    matchCounter++
  })
  t.is(matchCounter, 0)
  await walk(42, async () => {
    matchCounter++
  })
  t.is(matchCounter, 0)
})

test.serial('walker should wait for async itemFns to finish', async (t) => {
  let cnt = 0

  await walk(stub, async () => {
    await new Promise((resolve) => {
      setTimeout(() => {
        cnt++
        resolve(true)
      }, 50)
    })
  })

  t.not(cnt, 0)
})
