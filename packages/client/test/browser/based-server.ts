import { createSimpleServer } from '@based/server'

const start = async () => {
  await createSimpleServer({
    port: 8081,
    auth: {
      verifyAuthState: (based, ctx, authState) => {
        if (authState.token === 'power' && !authState.userId) {
          return { ...authState, userId: 'power-user-id' }
        }
        return true
      },
    },
    functions: {
      hello: async () => {
        return 'here!'
      },
    },
    queryFunctions: {
      counter: (based, payload, update) => {
        let cnt = 0
        update({ cnt })
        const int = setInterval(() => {
          update({ cnt: ++cnt })
        }, payload.speed)
        return () => {
          clearInterval(int)
        }
      },
    },
  })
}

start()
