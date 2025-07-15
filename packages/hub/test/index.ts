import { wait } from '@saulx/utils'
import { test } from 'node:test'
import start from '../src'
import connect from '@based/client'

test('based hub integration', async (t) => {
  const close = await start({
    port: 8080,
    path: './tmp',
  })
  t.after(() => {
    return close()
  })
  const client = connect({
    url: 'ws://localhost:8080',
  })
  t.after(() => {
    return client.destroy()
  })
  const res = await client.stream('_set-function', {
    contents: `console.log('hello world!!');export default async () => {console.log('hello function!!!!');return 'x'}`,
    payload: {
      checksum: 1,
      config: {
        name: 'test',
        type: 'function',
      },
    },
  })
  console.log(res)
  await client.call('test')
  const res3 = await client.call('_set-schema', [
    {
      db: 'default',
      schema: {
        types: {
          test: {
            name: 'string',
          },
        },
      },
    },
  ])

  const res4 = await client.stream('_set-function', {
    contents: `export default async (based) => {
    try {
    based.db.query('test').get().toObject()
  } catch (e) {
   console.error(e)}
  }`,
    payload: {
      checksum: 1,
      config: {
        name: 'test2',
        type: 'function',
      },
    },
  })

  await wait(1000)
  await client.call('test2')
  const schema = await client.query('_schema').get()

  console.log(schema)
})
