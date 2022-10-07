const createServer = require('@based/server').default
const { wait } = require('@saulx/utils')
const { join } = require('node:path')

// const json = require('./tmp.json')

const init = async () => {
  const functions = {
    flap: {
      path: '/mygur',
      name: 'flap',
      checksum: 1,
      function: async () => {
        await wait(100)
        return 'FLAP'
      },
    },
    streamboy: {
      name: 'streamboy',
      stream: true,
      checksum: 1,
      function: async ({ payload, stream }) => {
        console.info('---------------Incoming stream! \n', payload)
        stream.on('progress', (p) => {
          console.info('progress', payload.name, p)
        })
        // await wait(5e3)
        return payload
      },
    },
    counter: {
      name: 'counter',
      observable: true,
      checksum: 1,
      function: async (payload, update) => {
        console.info('init counter')
        let cnt = 0
        const x = []
        const counter = setInterval(() => {
          if (cnt > 99) {
            cnt = 0
          }
          cnt++

          for (let i = 0; i < 2; i++) {
            x.push({ cnt, i, name: 'hello' })
          }
          update(x)
        }, 2000)
        return () => {
          clearInterval(counter)
        }
      },
    },
  }

  await createServer({
    cert: join(__dirname, 'secret/cert.pem'),
    key: join(__dirname, 'secret/key.pem'),
    port: 9910,
    functions: {
      memCacheTimeout: 3e3,
      idleTimeout: 1e3,
      uninstall: async () => {
        return true
      },
      route: ({ path, name }) => {
        if (path) {
          for (const name in functions) {
            if (functions[name].path === path) {
              return functions[name]
            }
          }
        }
        if (functions[name]) {
          return functions[name]
        }
        return false
      },
      install: async ({ name }) => {
        if (functions[name]) {
          return functions[name]
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
