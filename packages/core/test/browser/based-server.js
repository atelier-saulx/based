const {
  default: createServer,
  runFunction,
  observe,
  get,
} = require('@based/server')

const ds = [0, 0, 0]

setInterval(() => {
  if (ds[1]) {
    ds[0]++
    ds[2] = ds[1]
    console.info(Math.round(ds[1] / ds[0] / 5 / 1000) + 'k', 'get/s')
  }
}, 5e3)

const init = async () => {
  const functions = {
    hello: {
      path: '/mygur',
      name: 'hello',
      checksum: 1,
      maxPayloadSize: 1e6 * 10,
      function: async (payload) => {
        return 'blabla ' + JSON.stringify(payload)
      },
    },
    helloNest: {
      path: '/mygurd',
      name: 'helloNest',
      checksum: 1,
      function: async (payload, ctx) => {
        const q = []
        for (let i = 0; i < 1e3; i++) {
          q.push(get(server, 'blaNest', ctx, payload))
        }
        await Promise.all(q)
        ds[1] += 1000
        const bla = await runFunction(server, 'hello', ctx, payload)
        return 'from nested => ' + bla
      },
    },
    timespend: {
      name: 'timespend',
      checksum: 1,
      function: async () => {
        return `all nested gets -> ${ds[0] / ds[1]}ms`
      },
    },
    blaNest: {
      observable: true,
      path: '/mysnapbla',
      name: 'blaNest',
      checksum: 1,
      function: async (payload, update, error) => {
        return observe(
          server,
          'bla',
          {},
          payload,
          update,
          error || ((err) => console.error('???ERROR TIME', err))
        )
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
          for (let i = 0; i < 1000; i++) {
            xyz.push('my snutx ' + i + Math.random() * 112231213)
          }
          cnt++
          update([
            xyz,
            'glurbatjof',
            cnt,
            cnt,
            cnt,
            cnt,
            [cnt, cnt, cnt, cnt, [cnt, cnt, cnt, cnt]],
          ])
        }, 500)
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
      uninstall: async ({ name }) => {
        console.info('go uninstall', name)
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
        console.info('go install', name)
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
