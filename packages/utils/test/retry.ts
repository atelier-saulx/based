import test from 'ava'
import { retry } from '../src/index.js'

test('retry', async (t) => {
  const fnFail = async () => {
    throw new Error('failed')
  }
  let d = Date.now()
  await t.throwsAsync(retry(fnFail, { timeout: 200, maxRetries: 3 }))
  let elapsed = Date.now() - d
  t.assert(elapsed >= 600)

  const fnSuccess = async () => {
    return 'flurp'
  }
  const res = await retry(fnSuccess, { timeout: 200, maxRetries: 3 })
  t.assert(res === 'flurp')

  let i = 0
  const fnFailTwice = async () => {
    if (i < 2) {
      i++
      throw new Error('no')
    } else {
      return 'yes'
    }
  }
  d = Date.now()
  const res2 = await retry(fnFailTwice, { timeout: 100, maxRetries: -1 })
  elapsed = Date.now() - d
  t.assert(res2 === 'yes')
  t.assert(elapsed > 200 && elapsed < 250)

  i = 0
  async function failsTwiceWithArgs(v: string) {
    if (i < 2) {
      i++
      throw new Error('no')
    } else {
      return v
    }
  }
  await t.throwsAsync(
    retry(failsTwiceWithArgs, { timeout: 100, maxRetries: 1 }, 'hello')
  )

  i = 0
  const res3 = await retry(
    failsTwiceWithArgs,
    { timeout: 100, maxRetries: -1 },
    'hello'
  )
  t.assert(res3 === 'hello')

  i = 0
  d = Date.now()
  const res4 = await retry(fnFailTwice, { maxRetries: -1 })
  elapsed = Date.now() - d
  t.assert(res4 === 'yes')
  t.assert(elapsed > 200 && elapsed < 250)
})
