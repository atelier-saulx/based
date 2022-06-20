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
    },
  })
  await createServer.default({
    port: 9101,
    db: {
      host: 'localhost',
      port: 9099,
    },
  })

  console.info('Started server!')
}

init().catch((err) => {
  console.error(err)
})
