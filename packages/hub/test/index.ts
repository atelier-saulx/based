import { wait } from '@saulx/utils'
import { test } from 'node:test'
import start from '../src/index.js'
import connect from '@based/client'
import { BasedFunction, BasedFunctionConfig } from '@based/functions'

await test('based hub integration', async (t) => {
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

  const setFunction = async (
    config: BasedFunctionConfig,
    fn: BasedFunction,
  ) => {
    await client.stream('based:set-function', {
      contents: `export default ${fn.toString()}`,
      payload: {
        checksum: 1,
        config: {
          name: 'test',
          type: 'function',
        },
      },
    })
    await wait(200)
    return config.name
  }

  const name = await setFunction(
    {
      name: 'test',
      type: 'function',
    },
    async () => {
      return 'success'
    },
  )

  t.assert.equal(await client.call(name), 'success')

  const defaultSchema = {
    types: {
      test: {
        name: 'string',
      },
    },
  }

  await client.call('db:set-schema', [
    {
      db: 'default',
      schema: defaultSchema,
    },
  ])

  const { schema } = await client.query('db:schema').get()

  t.assert.deepEqual(schema, defaultSchema)
})
