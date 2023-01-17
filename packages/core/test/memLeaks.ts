import test from 'ava'
import { BasedClient } from '../src/index'
import { createSimpleServer } from '@based/server'
import { wait } from '@saulx/utils'

test.serial('mem tests', async (t) => {
  await createSimpleServer({
    port: 9910,
    functions: {
      hello: async () => {
        await wait(3e3)
        return 'hello'
      },
    },
  })

  console.info(
    `Mem before ${
      Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100
    } MB`
  )

  const cl: Set<BasedClient> = new Set()

  for (let i = 0; i < 100; i++) {
    const client = new BasedClient()
    client.connect({
      url: async () => {
        return 'ws://localhost:9910'
      },
    })
    cl.add(client)
  }

  Promise.all(
    [...cl.values()].map((c) => {
      for (let i = 0; i < 1000; i++) {
        c.call('hello').catch(() => {})
      }
      return undefined
    })
  )

  const used = process.memoryUsage().heapUsed / 1024 / 1024
  console.info(
    `Mem while exec functions disconnect approximately ${
      Math.round(used * 100) / 100
    } MB`
  )

  await wait(10000)

  const used1 = process.memoryUsage().heapUsed / 1024 / 1024
  console.info(
    `Mem before disconnect approximately ${Math.round(used1 * 100) / 100} MB`
  )

  for (const client of cl) {
    client.disconnect()
    cl.delete(client)
  }

  await wait(10000)

  // @ts-ignore

  const used2 = process.memoryUsage().heapUsed / 1024 / 1024
  console.info(
    `Mem after disconnect approximately ${Math.round(used2 * 100) / 100} MB`
  )

  t.true(used2 < 160, 'Does not use too much mem')
})
