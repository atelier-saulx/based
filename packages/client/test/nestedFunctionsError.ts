import test from 'ava'
import { BasedClient } from '../src/index'
import { createSimpleServer } from '@based/server'
import fetch from 'cross-fetch'
import { wait } from '@saulx/utils'

test.serial('nested functions internal only', async (t) => {
  const client = new BasedClient()
  const server = await createSimpleServer({
    uninstallAfterIdleTime: 1e3,
    port: 9910,
    functions: {
      helloInternal: {
        internalOnly: true,
        function: async () => {
          return 'internal'
        },
      },
      hello: async (based, payload, ctx) => {
        return based.call('helloInternal', payload, ctx)
      },
    },
  })
  await client.connect({
    url: 'ws://localhost:9910',
  })
  t.is(await client.call('hello'), 'internal')
  await t.throwsAsync(client.call('snuix'))
  await t.throwsAsync(client.call('helloInternal'))
  const r = await fetch('http://localhost:9910/helloInternal')
  t.is(r.status, 404)
  client.destroy()
  await server.destroy()
})

test.serial('nested functions fn does not exist error', async (t) => {
  const client = new BasedClient()
  const server = await createSimpleServer({
    uninstallAfterIdleTime: 1e3,
    port: 9910,
    functions: {
      hello: async (based, payload, ctx) => {
        return based.call('blabla', payload, ctx)
      },
    },
  })
  await client.connect({
    url: 'ws://localhost:9910',
  })
  const err = await t.throwsAsync(client.call('hello'))
  // @ts-ignore
  t.is(err.code, 50001)
  await server.destroy()
})

test.serial('nested query functions fn does not exist error', async (t) => {
  const client = new BasedClient()
  const server = await createSimpleServer({
    uninstallAfterIdleTime: 1e3,
    port: 9910,
    queryFunctions: {
      hello: async (based, payload, update) => {
        return based.query('blabla').subscribe(update)
      },
    },
  })
  await client.connect({
    url: 'ws://localhost:9910',
  })

  const errors: any[] = []
  let r = 0

  client.query('hello').subscribe(
    () => {
      r++
    },
    (err) => {
      errors.push(err)
    }
  )

  await wait(500)

  t.is(r, 0)
  t.is(errors.length, 1)
  t.is(errors[0].code, 40401)

  client.destroy()
  await server.destroy()
})