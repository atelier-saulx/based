import { BasedServer } from '@based/server'
import { BasedQueryFunction } from '@based/functions'

const counter: BasedQueryFunction<{ speed: number }, { cnt: number }> = (
  _based,
  payload,
  update
) => {
  let cnt = 0
  // update({ cnt })
  const int = setInterval(() => {
    update({ cnt: ++cnt })
  }, payload.speed ?? 1e3)
  return () => {
    clearInterval(int)
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
