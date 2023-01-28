import { createSimpleServer } from '@based/server'

createSimpleServer({
  port: 8081,
  functions: {
    hello: async () => {
      return 'here!'
    },
  },
  queryFunctions: {
    counter: (based, payload, update) => {
      let cnt = 0
      const int = setInterval(() => {
        update({ cnt: ++cnt })
      }, payload.speed)
      return () => {
        clearInterval(int)
      }
    },
  },
})
