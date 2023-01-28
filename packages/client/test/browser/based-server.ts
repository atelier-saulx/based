import { createSimpleServer } from '@based/server'

createSimpleServer({
  port: 8081,
  functions: {
    hello: async () => {
      return 'here!'
    },
  },
})
