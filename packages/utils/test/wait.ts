import test from 'ava'
import { wait } from '../src/index.js'

test('wait ', async (t) => {
  const d = Date.now()
  await wait(1e3)
  t.true(Date.now() - d > 999)
})
