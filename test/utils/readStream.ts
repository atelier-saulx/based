import { createReadStream } from 'fs'
import { join } from 'path'
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { equal, test } from '../shared/index.js'
import { readStream } from '../../src/utils/index.js'
import assert from 'assert'
const __dirname = fileURLToPath(dirname(import.meta.url))

await test('readStream', async (t) => {
  const v = await readStream(
    createReadStream(join(__dirname, '../../package.json')),
  )
  const pkg = JSON.parse(v.toString())
  equal(pkg.name, '@based/utils')
})

await test('readStreamLarger', async (t) => {
  const v = await readStream(
    createReadStream(join(__dirname, './readStream.js')),
    {
      throttle: 10,
      maxChunkSize: 100,
    },
  )
  const pkg = v.toString()
  assert(pkg.includes('readStreamLarger'))
})
