const createServer = require('@based/server')
const { start } = require('@saulx/selva-server')

const init = async () => {
  const selvaServer = await start({
    port: 9099,
    pipeRedisLogs: { stdout: false, stderr: false },
  })
  await selvaServer.selvaClient.updateSchema({
    types: {
      thing: {
        fields: {
          name: { type: 'string' },
          nested: {
            type: 'object',
            properties: {
              something: { type: 'string' },
            },
          },
        },
      },
      user: {
        prefix: 'us',
        fields: {
          name: { type: 'string' },
          email: { type: 'string' },
          password: { type: 'digest' },
          status: { type: 'string' },
        },
      },
    },
  })

  await selvaServer.selvaClient.set({
    type: 'user',
    password: 'bla',
    email: 'bla@bla.com',
    $alias: 'bla@bla.com',
  })

  await createServer.default({
    port: 9101,
    db: {
      host: 'localhost',
      port: 9099,
    },
    config: {
      functions: {
        renewToken: {
          observable: false,
          function: async ({ payload }) => {
            console.info('flap flap', payload)

            const { refreshToken } = payload
            const { now } = JSON.parse(refreshToken)
            if (Date.now() - now < 10e3) {
              return { token: JSON.stringify({ now: Date.now() }) }
            }
            throw new Error('invalid refreshToken')
          },
        },
        registerUser: {
          observable: false,
          function: async ({ based, payload }) => {
            const { id } = await based.set({
              $id: await based.id('user', payload.email),
              email: payload.email,
              $alias: payload.email,
              password: payload.password,
            })
            return {
              token: JSON.stringify({ now: Date.now() }),
              refreshToken: JSON.stringify({ now: Date.now() }),
              email: payload.email,
              id,
            }
          },
        },
        login: {
          observable: false,
          function: async ({ based, payload }) => {
            const { id } = await based.get({ $alias: payload.email, id: true })
            return {
              token: JSON.stringify({ now: Date.now() }),
              refreshToken: JSON.stringify({ now: Date.now() }),
              email: payload.email,
              id,
            }
          },
        },
      },
      authorize: async ({ user, name, type, callStack }) => {
        console.info(type, name, callStack)
        if (name === 'registerUser' || callStack.length) {
          return true
        }
        if (!(await user?.token())) {
          return false
        }

        const { now } = JSON.parse(await user?.token())
        if (Date.now() - now < 3e3) {
          return true
        } else {
          console.error('WRONG')
          throw new Error('Token expired')
        }
      },
    },
  })

  console.info('Started server!')
}

init().catch((err) => {
  console.error(err)
})
