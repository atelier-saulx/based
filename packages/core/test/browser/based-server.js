const createServer = require('@based/server')
const { start } = require('@saulx/selva-server')

const json = require('./tmp.json')

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
    },
  })

  let i = 0

  await createServer.default({
    port: 9101,
    db: {
      host: 'localhost',
      port: 9099,
    },
    config: {
      functions: {
        bla: {
          shared: true,
          observable: true,
          function: async ({ update }) => {
            const interval = setInterval(() => {
              const snurx = {
                cnt: i++,
                Sadsadsdas: '1212312312321',
                cczxxzccxzxcz: Math.random() * 11221,
              }

              if (Math.random() * 2 > 1) {
                snurx.json = json
              }

              update(snurx)
            }, 0)
            return () => {
              clearInterval(interval)
            }
          },
        },
      },
    },
  })

  let p = i
  setInterval(() => {
    console.info('send', i, i - p, '/sec')
    p = i
  }, 10e3)

  // server

  console.info('Started server!')
}

init().catch((err) => {
  console.error(err)
})
