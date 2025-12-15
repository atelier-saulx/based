import assert from 'node:assert'
import { wait } from '../../src/utils/index.js'
import { test } from '../shared/index.js'

await test('wait ', async (t) => {
  const d = Date.now()
  await wait(1e3)
  assert(Date.now() - d > 999)
})
