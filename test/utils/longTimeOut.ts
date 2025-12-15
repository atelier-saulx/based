import assert from 'node:assert'
import { setLongTimeout } from '../../src/utils/index.js'
import { test } from '../shared/index.js'

await test('timer goes brrr ', async (t) => {
  const x = { v: false }
  await new Promise<void>((res) => {
    setLongTimeout(() => {
      x.v = true
      res()
    }, 200)
  })
  assert(x.v)
})
await test('timer no', async (t) => {
  const x = { v: false }

  await new Promise<void>((res) => {
    const timer = setLongTimeout(() => {
      x.v = true
    }, 200)
    timer()
    res()
  })

  assert(x.v)
})
