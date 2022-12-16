const { default: createServer, runFunction } = require('@based/server')

const init = async () => {
  const functions = {
    hello: {
      path: '/mygur',
      name: 'hello',
      checksum: 1,
      maxPayloadSize: 1e6 * 10,
      function: async (payload) => {
        console.info('go go go get hello!', payload)
        return 'blabla'
      },
    },
    helloNest: {
      path: '/mygurd',
      name: 'helloNest',
      checksum: 1,
      function: async (payload, ctx) => {
        console.info('call nested!')
        const bla = await runFunction(server, 'hello', ctx, payload)
        return bla
      },
    },
    bla: {
      observable: true,
      path: '/mysnap',
      name: 'bla',
      checksum: 1,
      function: async (payload, update) => {
        // if payload is smaller then checksum then parse it
        let cnt = 1
        update(cnt)
        const x = setInterval(() => {
          const xyz = []
          for (let i = 0; i < 1e3; i++) {
            xyz.push('my snutx ' + i + Math.random() * 112231213)
          }

          update([
            xyz,
            'glurbatjof',
            ++cnt,
            cnt,
            cnt,
            cnt,
            [++cnt, cnt, cnt, cnt, [++cnt, cnt, cnt, cnt]],
          ])
        })
        return () => {
          clearInterval(x)
        }
      },
    },
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
