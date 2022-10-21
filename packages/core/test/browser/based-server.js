const createServer = require('@based/server').default
const { join } = require('node:path')

// const json = require('./tmp.json')

const init = async () => {
  const functions = {
    hello: {
      path: '/mygur',
      name: 'hello',
      checksum: 1,
      maxPayload: 1e9,
      functionPath: join(__dirname, '/hello.js'),
    },
    // streamboy: {
    //   name: 'streamboy',
    //   stream: true,
    //   checksum: 1,
    //   function: async ({ payload, stream }) => {
    //     console.info('---------------Incoming stream! \n', payload)
    //     stream.on('progress', (p) => {
    //       console.info('progress', payload.name, p)
    //     })
    //     // await wait(5e3)
    //     return payload
    //   },
    // },
    // counter: {
    //   name: 'counter',
    //   observable: true,
    //   checksum: 1,
    //   function: async (payload, update) => {
    //     console.info('init counter')
    //     let cnt = 0
    //     const x = []
    //     const counter = setInterval(() => {
    //       if (cnt > 99) {
    //         cnt = 0
    //       }
    //       cnt++

    //       for (let i = 0; i < 2; i++) {
    //         x.push({ cnt, i, name: 'hello' })
    //       }
    //       update(x)
    //     }, 2000)
    //     return () => {
    //       clearInterval(counter)
    //     }
    //   },
    // },
  }

  const server = await createServer({
    // cert: join(__dirname, 'secret/cert.pem'),
    // key: join(__dirname, 'secret/key.pem'),
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

  server.on('error', (client, err) => {
    console.error(err)
  })

  console.info('Started server!')
}

init().catch((err) => {
  console.error(err)
})
