import { BasedServer } from '@based/server'

const counter = (_based, payload, update) => {
  if (payload.count) {
    let cnt = 0
    const int = setInterval(() => {
      update({ count: ++cnt })
    }, payload.speed ?? 1e3)
    return () => {
      clearInterval(int)
    }
  }
}

const server = new BasedServer({
  port: 8081,
  functions: {
    configs: {
      counter: {
        type: 'query',
        fn: counter,
      },
    },
  },
})

server.start()
