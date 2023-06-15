import { BasedServer } from '@based/server'
import { BasedQueryFunction } from '@based/functions'

const counter: BasedQueryFunction<{ speed: number }, { cnt: number }> = (
  _based,
  payload,
  update
) => {
  let cnt = 0
  update({ cnt })
  const int = setInterval(() => {
    update({ cnt: ++cnt })
  }, payload.speed)
  return () => {
    clearInterval(int)
  }
}

const start = async () => {
  const server = new BasedServer({
    port: 8081,
    auth: {
      authorize: async (_based, _ctx, name) => {
        if (name === 'notAllowedFiles') {
          return false
        }
        return true
      },
      verifyAuthState: async (_based, _ctx, authState) => {
        if (authState.token === 'power' && !authState.userId) {
          return { ...authState, userId: 'power-user-id' }
        }
        return true
      },
    },
    functions: {
      uninstallAfterIdleTime: 1e3,
      configs: {
        counter: {
          type: 'query',
          fn: counter,
        },
      },
    },
  })

  server.start()
}

start()
