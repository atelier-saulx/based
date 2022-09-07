const createServer = require('@based/server').default
const { wait } = require('@saulx/utils')

const json = require('./tmp.json')

const init = async () => {
  const store = {
    flap: async () => {
      await wait(3e3)
      return 'FLAP'
    },
    small: async () => 'he',
    iqTest: async () => json,
    counter: async (payload, update) => {
      console.info('init counter', payload)
      let cnt = 0
      const counter = setInterval(() => {
        let x = ''
        for (let i = 0; i < 1000; i++) {
          x += ++cnt + 'Hello numm ' + i
        }
        update(x)
      }, 2000)
      return () => {
        clearInterval(counter)
      }
    },
  }

  await createServer({
    port: 9910,
    functions: {
      memCacheTimeout: 3e3,
      idleTimeout: 1e3,
      unregister: async () => {
        return true
      },
      registerByPath: async ({ path }) => {
        if (path === '/') {
          return {
            name: 'flap',
            checksum: 1,
            function: store.flap,
            observable: false,
          }
        }
        return false
      },
      register: async ({ name }) => {
        if (store[name]) {
          return {
            name,
            checksum: 1,
            function: store[name],
            observable: name === 'counter',
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
