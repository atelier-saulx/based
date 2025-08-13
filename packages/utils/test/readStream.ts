import test from 'ava'
import { readStream } from '../src/index.js'
import { createReadStream } from 'fs'
import { join } from 'path'
import { dirname } from 'path'
import { fileURLToPath } from 'url'
const __dirname = fileURLToPath(dirname(import.meta.url))

test('readStream', async (t) => {
  const v = await readStream(
    createReadStream(join(__dirname, '../../package.json')),
  )
  const pkg = JSON.parse(v.toString())
  t.is(pkg.name, '@based/utils')
  t.pass()
})

test('readStreamLarger', async (t) => {
  const v = await readStream(
    createReadStream(join(__dirname, './readStream.js')),
    {
      throttle: 10,
      maxChunkSize: 100,
    },
  )
  const pkg = v.toString()
  t.true(pkg.includes('readStreamLarger'))
  t.pass()
})
