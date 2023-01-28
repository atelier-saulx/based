import { createSimpleServer } from '@based/server'
import { readStream } from '@saulx/utils'

const files: { [key: string]: { file: Buffer; mimeType: string } } = {}

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
      file: {
        function: async (based, payload) => {
          return payload.id
        },
        customHttpResponse: async (id, payload, ctx) => {
          ctx.session?.res.writeHeader('cache-control', 'immutable')
          ctx.session?.res.writeHeader('mime-type', files[id].mimeType)
          ctx.session?.res.end(files[id].file)
          return true
        },
      },
      hello: async () => {
        return 'This is a response from hello'
      },
      files: {
        stream: true,
        function: async (based, x) => {
          const { stream, mimeType } = x
          console.log(x)
          const id = (~~(Math.random() * 9999999)).toString(16)
          files[id] = { file: await readStream(stream), mimeType }
          return { success: 'filetime', id, mimeType }
        },
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
