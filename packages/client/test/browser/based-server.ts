import { createSimpleServer } from '@based/server'
import { BasedFunction, BasedQueryFunction } from '@based/functions'
import fs from 'node:fs'
import { join } from 'path'

const files: { [key: string]: { file: string; mimeType: string } } = {}

const TMP = join(__dirname, 'tmp')

const hello: BasedFunction<void, string> = async () => {
  return 'This is a response from hello'
}

const counter: BasedQueryFunction<{ speed: number }, { cnt: number }> = (
  based,
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
  fs.readdir(TMP, (err, files) => {
    if (err) throw err
    for (const file of files) {
      fs.unlink(join(TMP, file), (err) => {
        if (err) throw err
      })
    }
  })

  await createSimpleServer({
    port: 8081,
    auth: {
      authorize: async (based, ctx, name, payload) => {
        console.info('--> Auth', name, payload)
        if (name === 'notAllowedFiles') {
          return false
        }
        return true
      },
      verifyAuthState: (based, ctx, authState) => {
        if (authState.token === 'power' && !authState.userId) {
          return { ...authState, userId: 'power-user-id' }
        }
        return true
      },
    },
    functions: {
      file: {
        headers: ['range'],
        function: async (based, payload) => {
          const x = fs.statSync(files[payload.id].file)
          return {
            file: fs.createReadStream(files[payload.id].file),
            mimeType: files[payload.id].mimeType,
            size: x.size,
          }
        },
        httpResponse: async (based, payload, responseData, send, ctx) => {
          ctx.session?.res.cork(() => {
            ctx.session?.res.writeStatus('200 OK')

            // ctx.session?.res.writeHeader('Access-Control-Allow-Origin', '*')
            // ctx.session?.res.writeHeader('Access-Control-Allow-Headers', '*')
            // ctx.session?.res.writeHeader('Cache-Control', 'immutable')
            ctx.session?.res.writeHeader('Content-Type', responseData.mimeType)
            console.log(responseData.size, ctx.session?.headers)
            // ctx.session?.res.writeHeader('Content-Length', result.size)

            responseData.file.on('data', (d) => {
              // console.info('chunk', d)
              ctx.session?.res.write(d)
            })

            responseData.file.on('end', () => {
              // console.log('END', d)
              ctx.session?.res.end()
            })
          })
        },
      },
      hello,
      brokenFiles: {
        stream: true,
        function: async () => {
          throw new Error('broken')
        },
      },
      notAllowedFiles: {
        stream: true,
        function: async () => {
          return { hello: true }
        },
      },
      files: {
        maxPayloadSize: 1e10,
        stream: true,
        function: async (based, x) => {
          const { stream, mimeType, payload, size } = x
          const id = x.fileName || 'untitled'
          x.stream.on('progress', (p) =>
            console.info(p, x.fileName, x.mimeType, stream)
          )
          const p = join(TMP, id + '.' + x.extension)
          stream.pipe(fs.createWriteStream(p))
          files[id] = { file: p, mimeType }
          return {
            success: 'filetime',
            id,
            mimeType,
            payload,
            size,
            rb: stream.receivedBytes,
          }
        },
      },
    },
    queryFunctions: {
      counter,
    },
  })
}

start()
