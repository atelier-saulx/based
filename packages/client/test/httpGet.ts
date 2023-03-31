import test from 'ava'
import { BasedServer } from '@based/server'
import fetch from 'cross-fetch'
import { wait } from '@saulx/utils'

test.serial('http get falsy check', async (t) => {
  const server = new BasedServer({
    port: 9910,
    functions: {
      uninstallAfterIdleTime: 1e3,
      specs: {
        bla: {
          query: true,
          closeAfterIdleTime: 3e3,
          function: (based, payload, update) => {
            update(0)
            return () => {}
          },
        },
      },
    },
    auth: {
      authorize: async () => true,
    },
  })
  await server.start()

  for (let i = 0; i < 100; i++) {
    const r1 = await (await fetch('http://localhost:9910/bla')).json()
    t.is(r1, 0)
    await wait(100)

    const r2 = await (await fetch('http://localhost:9910/bla')).text()
    t.is(r2, '0')

    await wait(100)
    const r3 = await (await fetch('http://localhost:9910/bla')).text()
    t.is(r3, '0')
  }

  await server.destroy()
})
