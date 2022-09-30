const createServer = require('@based/server').default
const { wait } = require('@saulx/utils')

const json = require('./tmp.json')

const init = async () => {
  const store = {
    // custom thing
    flap: async () => {
      await wait(100)
      return 'FLAP'
    },
    small: async (x) => x,
    iqTest: async () => json,
    counter: async (payload, update) => {
      console.info('init counter')
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
      uninstall: async () => {
        return true
      },
      route: ({ path, name }) => {
        if (path === '/') {
          return {
            name: 'flap',
          }
        }
        if (name && store[name]) {
          return {
            name,
            observable: name === 'counter',
          }
        }
        return false
      },
      install: async ({ name }) => {
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
