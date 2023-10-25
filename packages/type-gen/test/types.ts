import test from 'ava'
import { updateTypes } from '../src'
import { join } from 'path'
import { readFile } from 'fs-extra'

test.serial('Generate types file from examples', async (t) => {
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

  const file = await readFile(join(__dirname, '../../client/dist/index.d.ts'), {
    encoding: 'utf-8',
  })

  t.is(result, join(__dirname, '../../client/dist/index.d.ts'))
  t.true(file.includes('counter'))
  t.true(file.includes('db:schema'))
  t.true(file.includes('db:update-schema'))
  t.true(file.includes('db:set'))
  t.true(file.includes('hello-world'))
})
