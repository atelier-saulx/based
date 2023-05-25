import { BasedServer } from '@based/server'
import {
  BasedFunction,
  BasedQueryFunction,
  isClientContext,
} from '@based/functions'
import fs from 'node:fs'
import { join } from 'path'
import { S3 } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { wait } from '@saulx/utils'

const files: { [key: string]: { file: string; mimeType: string } } = {}

const TMP = join(__dirname, 'tmp')

const hello: BasedFunction<void, string> = async (based, payload, ctx) => {
  return (
    'This is a response from hello ' +
    (isClientContext(ctx) ? ctx.session?.origin : '')
  )
}

const path = join(
  __dirname,
  // ======= Add your credentials location here
  '../../../../../based-cloud/packages/vault/src/local/keys/secrets.json'
)
let fileSecrets: any = {}

try {
  fileSecrets = JSON.parse(fs.readFileSync(path).toString())
} catch (err) {
  console.info('No s3 credentials found - skip s3')
}

const { r2AccessKeyId, r2SecretAccessKey, cloudflareAccountId } = fileSecrets

const s3Client: S3 = new S3({
  region: 'auto',
  endpoint: `https://${cloudflareAccountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: r2AccessKeyId,
    secretAccessKey: r2SecretAccessKey,
  },
})

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

const staticSub: BasedQueryFunction<
  { special: number },
  { title: string; id: number }[]
> = (_based, _payload, update) => {
  const data: { title: string; id: number }[] = []
  for (let i = 0; i < 1000; i++) {
    data.push({
      id: i,
      title: 'yes ' + i,
    })
  }
  update(data)
  return () => {}
}

const staticSubHuge: BasedQueryFunction<
  { special: number },
  { title: string; id: number }[]
> = (_based, _payload, update) => {
  const data: { title: string; id: number }[] = []
  for (let i = 0; i < 100000; i++) {
    data.push({
      id: i,
      title: 'yes ' + i,
    })
  }
  update(data)
  return () => {}
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
        file: {
          type: 'function',
          headers: ['range'],
          fn: async (_based, payload) => {
            const x = fs.statSync(files[payload.id].file)
            return {
              file: fs.createReadStream(files[payload.id].file),
              mimeType: files[payload.id].mimeType,
              size: x.size,
            }
          },
          httpResponse: async (_based, _payload, responseData, _send, ctx) => {
            ctx.session?.res.cork(() => {
              ctx.session?.res.writeStatus('200 OK')
              ctx.session?.res.writeHeader(
                'Content-Type',
                responseData.mimeType
              )
              responseData.file.on('data', (d: any) => {
                ctx.session?.res.write(d)
              })
              responseData.file.on('end', () => {
                ctx.session?.res.end()
              })
            })
          },
        },
        hello: {
          type: 'function',
          fn: hello,
        },
        longWait: {
          type: 'function',
          fn: async () => {
            console.log('lets wait long')
            await wait(60e3)
            return true
          },
        },
        brokenFiles: {
          type: 'stream',
          fn: async () => {
            throw new Error('broken')
          },
        },
        notAllowedFiles: {
          type: 'stream',
          fn: async () => {
            return { hello: true }
          },
        },
        files: {
          type: 'stream',
          maxPayloadSize: 1e10,
          fn: async (_based, x) => {
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
        filess3: {
          name: 'files-s3',
          type: 'stream',
          maxPayloadSize: 1e10,
          fn: async (
            _based,
            { stream, extension, fileName, size, mimeType }
          ) => {
            const Bucket = 'based-test-bucket'

            console.info('file to s3:', fileName, extension, size, mimeType)

            if (!fileName) {
              fileName = 'snapje'
            }

            const Key = `myfile-${fileName}`

            const parallelUploads3 = new Upload({
              client: s3Client,
              // partSize: '5MB', // optional size of each part
              params: {
                Bucket,
                Key,
                Body: stream,
                ContentType: mimeType,
                // There is a bug when using this argument.
                // Both in AWS and R2
                // https://github.com/aws/aws-sdk-js-v3/issues/3915
                // ContentLength: size,
              },
            })

            // stream.pipe(s)

            stream.on('progress', (data) => {
              console.info('progres', data)
            })

            let total = 0

            stream.on('data', (c) => {
              total += c.byteLength
              console.info('chunk time!', c.byteLength)
            })

            // stream.on('end', () => {
            //   console.info('WTF END!')
            // })

            parallelUploads3.on('httpUploadProgress', (progress) => {
              console.info('uploading progress!', progress)
            })

            try {
              await parallelUploads3.done()
            } catch (err) {
              console.log(total, 'vs', size)
              return { err, total, size }
            }

            const baseUrl = `https://pub-9d1a27a91117440c90400467ddba7c8b.r2.dev`

            return { Key, Bucket, url: `${baseUrl}/${encodeURIComponent(Key)}` }
          },
        },
        counter: {
          type: 'query',
          fn: counter,
        },
        staticSub: {
          type: 'query',
          fn: staticSub,
        },
        staticSubHuge: {
          type: 'query',
          fn: staticSubHuge,
        },
      },
    },
  })

  server.start()
}

start()

// uws
//   .App()
//   .options('/*', (res, req) => {
//     res.writeHeader('Access-Control-Allow-Origin', '*')
//     res.writeHeader('Access-Control-Allow-Headers', '*')
//     res.end('')
//   })
//   .post('/*', (res, req) => {
//     res.writeHeader('Access-Control-Allow-Origin', '*')
//     res.writeHeader('Access-Control-Allow-Headers', '*')
//     console.info('Posted to ' + req.getUrl())
//     res.onData((chunk, isLast) => {
//       /* Buffer this anywhere you want to */
//       console.info(
//         'Got chunk of data with length ' +
//           chunk.byteLength +
//           ', isLast: ' +
//           isLast
//       )
//       /* We respond when we are done */
//       if (isLast) {
//         res.end('Thanks for the data!')
//       }
//     })
//     res.onAborted(() => {
//       /* Request was prematurely aborted, stop reading */
//       console.info('Eh, okay. Thanks for nothing!')
//     })
//   })
//   .listen(8082, (token) => {
//     if (token) {
//       console.info('Listening to port ' + 8082)
//     } else {
//       console.info('Failed to listen to port ' + 8082)
//     }
//   })

// // create a server object:
// http
//   .createServer(function (req, res) {
//     res.setHeader('Access-Control-Allow-Origin', '*')
//     res.setHeader('Access-Control-Allow-Headers', '*')
//     if (req.method === 'post') {
//       req.on('data', (d) => {
//         console.info('CHUNK', d)
//       })
//       req.on('end', () => {
//         console.info('lullz')
//       })
//     } else {
//       res.end()
//     }
//   })
//   .listen(8083)
