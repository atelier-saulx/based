import test from 'ava'
import { updateTypes } from '../src'
import { readFile } from 'fs-extra'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'url'
const __dirname = dirname(fileURLToPath(import.meta.url))

test('Generate types file from examples', async (t: T) => {
  const result = await updateTypes([
    {
      config: require('./examples/helloWorld/based.config.json'),
      path: join(__dirname, '/examples/helloWorld/index.ts'),
    },
    {
      config: require('./examples/query/based.config.json'),
      path: join(__dirname, '/examples/query/index.ts'),
    },
    {
      config: { name: 'db:set', type: 'function' },
      payload: 'any',
      result: 'any',
    },
    {
      config: { name: 'db:update-schema', type: 'function' },
      payload: 'any',
      result: 'any',
    },
    {
      config: { name: 'db', type: 'query' },
      payload: 'any',
      result: 'any',
    },
    {
      config: { name: 'db:schema', type: 'query' },
      payload: 'any',
      result: 'any',
    },
  ])

  const files = await Promise.all(
    ['client/dist/index.d.ts', 'functions/dist/client.d.ts'].map((f) =>
      readFile(join(__dirname, '../../' + f), {
        encoding: 'utf-8',
      })
    )
  )

  t.is(result.clientPath, join(__dirname, '../../client/dist/index.d.ts'))
  t.is(result.functionPath, join(__dirname, '../../functions/dist/client.d.ts'))

  for (const file of files) {
    t.true(file.includes('counter'))
    t.true(file.includes('db:schema'))
    t.true(file.includes('db:update-schema'))
    t.true(file.includes('db:set'))
    t.true(file.includes('hello-world'))
  }
})
