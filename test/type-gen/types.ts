import { readFile } from 'fs/promises'
import { readJSON } from 'fs-extra/esm'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'url'
import { updateTypes } from '../../src/type-gen/index.js'
import { equal, test } from '../shared/index.js'
import assert from 'node:assert'

const __dirname = dirname(fileURLToPath(import.meta.url))
const srcDirname = __dirname.replace('/dist/test', '/test')

await test('Generate types file from examples', async (t) => {
  const result = await updateTypes([
    {
      config: await readJSON(
        join(srcDirname, '/examples/helloWorld/based.config.json'),
      ),
      path: join(srcDirname, '/examples/helloWorld/index.ts'),
    },
    {
      config: await readJSON(
        join(srcDirname, './examples/query/based.config.json'),
      ),
      path: join(srcDirname, '/examples/query/index.ts'),
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
    ['client/dist/src/index.d.ts', 'functions/dist/client.d.ts'].map((f) =>
      readFile(join(srcDirname, '../../' + f), {
        encoding: 'utf-8',
      }),
    ),
  )

  equal(result.clientPath, join(srcDirname, '../../client/dist/src/index.d.ts'))
  equal(
    result.functionPath,
    join(srcDirname, '../../functions/dist/client.d.ts'),
  )

  for (const file of files) {
    assert(file.includes('counter'))
    assert(file.includes('db:schema'))
    assert(file.includes('db:update-schema'))
    assert(file.includes('db:set'))
    assert(file.includes('hello-world'))
  }
})
