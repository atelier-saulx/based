import { wait } from '@saulx/utils'
import start from '../src/index.js'
import connect from '@based/client'
import {
  BasedChannelFunction,
  BasedFunction,
  BasedFunctionConfig,
  BasedQueryFunction,
} from '@based/functions'
import { serialize } from '@based/schema'
import assert from 'node:assert'
import { rm } from 'node:fs/promises'

const testit = async () => {
  await rm('./tmp', { recursive: true, force: true })
  const close = await start({
    port: 8080,
    path: './tmp',
  })

  const client = connect({
    url: 'ws://localhost:8080',
  })

  const setFunction = async (
    config: BasedFunctionConfig,
    fn: BasedFunction | BasedQueryFunction | BasedChannelFunction,
  ) => {
    if (config.type === 'channel') {
      let contents = ''
      if ('publisher' in fn) {
        contents += `export const publisher = ${fn.publisher.toString()};\n`
      }
      if ('subscriber' in fn) {
        contents += `export const subscriber = ${fn.subscriber.toString()};\n`
      }

      await client.stream('based:set-function', {
        contents,
        payload: {
          config,
        },
      })
    } else {
      await client.stream('based:set-function', {
        contents: `export default ${fn.toString()}`,
        payload: {
          config,
        },
      })
    }
    await wait(200)
  }

  await setFunction(
    {
      name: 'test',
      type: 'function',
    },
    async () => {
      return 'success'
    },
  )

  assert.equal(await client.call('test'), 'success')

  await setFunction(
    {
      name: 'test-query',
      type: 'query',
    },
    // @ts-ignore
    async (based, payload, update) => {
      update('success')
      return () => {}
    },
  )

  assert.equal(await client.query('test-query').get(), 'success')

  await setFunction(
    {
      name: 'test-channel',
      type: 'channel',
    },

    // @ts-ignore
    {
      // @ts-ignore
      // @ts-ignore
      publisher: async () => {
        console.log('publishing')
        // @ts-ignore
        global.publishedIt = true
      },
      subscriber: async () => {
        console.log('subscribing')
        // @ts-ignore
        global.subscribedIt = true
      },
    },
  )

  assert.equal(await client.query('test-query').get(), 'success')

  await client.channel('test-channel').publish('rando')
  await client.channel('test-channel').subscribe(() => {})

  await wait(100)

  // @ts-ignore
  assert.equal(global.publishedIt, true)
  // @ts-ignore
  assert.equal(global.subscribedIt, true)

  const defaultSchema = {
    types: {
      test: {
        name: 'string',
      },
    },
  }

  await client.call(
    'db:set-schema',
    serialize({
      db: 'default',
      schema: defaultSchema,
    }),
  )

  const { schema } = await client.query('db:schema').get()

  assert.deepEqual(schema, defaultSchema)

  await client.destroy()
  await close()
  process.exit(0)
}

testit()
