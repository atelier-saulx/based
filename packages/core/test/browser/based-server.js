const createServer = require('@based/server').default

const json = require('./tmp.json')

const init = async () => {
  const store = {
    iqTest: async () => json,
  }

  await createServer({
    port: 9910,
    functions: {
      memCacheTimeout: 3e3,
      idleTimeout: 1e3,
      unregister: async () => {
        return true
      },
      register: async ({ name }) => {
        if (store[name]) {
          return {
            name,
            checksum: 1,
            function: store[name],
          }
        } else {
          return false
        }
      },
      log: (opts) => {
        console.info('log from fn', opts)
      },
    },
  })

  console.info('Started server!')
}

init().catch((err) => {
  console.error(err)
})
