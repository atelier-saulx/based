import test from 'ava'
import { setLongTimeout } from '../src/longTimeOut.js'

test('timer goes brrr ', async (t) => {
  const x = { v: false }
  await new Promise<void>((res) => {
    setLongTimeout(() => {
      x.v = true
      res()
    }, 200)
  })
  t.true(x.v)
})
test('timer no', async (t) => {
  const x = { v: false }

  await new Promise<void>((res) => {
    const timer = setLongTimeout(() => {
      x.v = true
    }, 200)
    timer()
    res()
  })

  t.false(x.v)
})
