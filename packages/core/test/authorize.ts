import test from 'ava'
import { BasedCoreClient } from '../src/index'
import { createSimpleServer } from '@based/server'
import { BasedError, BasedErrorCode } from '../src/types/error'
import { wait } from '@saulx/utils'

const setup = async () => {
  const coreClient = new BasedCoreClient()

  const server = await createSimpleServer({
    port: 9910,
    functions: {
      hello: async (payload) => {
        if (payload) {
          return payload
        }
        return 'flap'
      },
    },
    observables: {
      counter: async (_payload, update) => {
        let cnt = 0
        update(cnt)
        const counter = setInterval(() => {
          update(++cnt)
        }, 1000)
        return () => {
          clearInterval(counter)
        }
      },
    },
    auth: {
      authorize: async (context, name) => {
        console.info('flap??', name, '---', context.session?.authState)
        return context.session?.authState === 'mock_token'
      },
    },
  })
  return { coreClient, server }
}

test.serial('authorize functions', async (t) => {
  t.timeout(1000)

  const token = 'mock_token'

  const { coreClient, server } = await setup()

  t.teardown(() => {
    coreClient.disconnect()
    server.destroy()
  })

  await coreClient.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })

  console.info('connect???')

  await t.throwsAsync(
    coreClient.call('hello', {
      bla: true,
    })
  )

  console.info('conblaaar!nect???')

  await coreClient.auth(token)
  await t.notThrowsAsync(
    coreClient.call('hello', {
      bla: true,
    })
  )
})

test.serial('authorize observe', async (t) => {
  t.timeout(12000)

  const token = 'mock_token'

  const { coreClient, server } = await setup()

  let counter: NodeJS.Timer

  t.teardown(() => {
    coreClient.disconnect()
    server.destroy()
  })

  await coreClient.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })

  await new Promise((resolve) => {
    coreClient.observe(
      'counter',
      () => {
        // console.info({ d })
      },
      {
        myQuery: 123,
      },
      (err: BasedError) => {
        t.is(err.code, BasedErrorCode.AuthorizeRejectedError)
        resolve(err)
      }
    )
  })

  await coreClient.auth(token)
  await wait(500)

  await new Promise((resolve) => {
    coreClient.observe(
      'counter',
      (d) => {
        resolve(d)
      },
      {
        myQuery: 123,
      },
      (err: BasedError) => {
        t.fail('Should not error when authed')
        resolve(err)
      }
    )
  })

  // @ts-ignore - totally incorrect typescript error...
  clearInterval(counter)
})

test.serial('authorize after observe', async (t) => {
  t.timeout(12000)

  const token = 'mock_token'

  const { coreClient, server } = await setup()
  let counter: NodeJS.Timer

  t.teardown(() => {
    coreClient.disconnect()
    server.destroy()
  })

  await coreClient.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })
  await wait(500)

  let receiveCnt = 0

  coreClient.observe(
    'counter',
    () => {
      receiveCnt++
    },
    {
      myQuery: 123,
    },
    (err: BasedError) => {
      t.is(err.code, BasedErrorCode.AuthorizeRejectedError)
    }
  )

  await wait(500)
  t.is(receiveCnt, 0)
  await coreClient.auth(token)
  await wait(500)

  // @ts-ignore - totally incorrect typescript error...
  clearInterval(counter)

  t.true(receiveCnt > 0)
})
