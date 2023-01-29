import { BasedClient, encodeAuthState } from '..'
import { StreamFunctionContents } from './types'
import getUrlFromOpts from '../getUrlFromOpts'
const inProgress: { [url: string]: boolean } = {}

const queue: {
  [functionName: string]: [
    StreamFunctionContents<File>,
    (x: any) => void,
    (err: Error) => void
  ][]
} = {}

const getUrl = async (client: BasedClient): Promise<string> => {
  let url = await getUrlFromOpts(client.opts)
  if (typeof url === 'function') {
    url = await url()
  }
  return url.replace(/^ws/, 'http')
}

const drainQueue = (
  client: BasedClient,
  functionName: string,
  authorization: string
) => {
  if (!inProgress[functionName]) {
    inProgress[functionName] = true

    setTimeout(async () => {
      inProgress[functionName] = false
      const url = await getUrl(client)
      const q = queue[functionName]

      queue[functionName] = []
      const body = new global.FormData()
      for (let i = 0; i < q.length; i++) {
        const options = q[i][0]
        const { contents, payload } = options
        const p = payload || {}
        body.append(`size=${contents.size},${JSON.stringify(p)}`, contents)
      }
      try {
        const xhr = new global.XMLHttpRequest()
        xhr.upload.onprogress = (p: ProgressEvent) => {
          const progress =
            // @ts-ignore
            (100 * (p.loaded || p.position)) / (p.totalSize || p.total)
          console.info(progress, 'upload§...')
        }
        xhr.onerror = (p) => {
          console.error('error!', p, 'flap', xhr.responseText)
        }
        xhr.timeout = 1e3 * 60 * 60 * 24
        xhr.onabort = (p) => {
          console.error('abort', p)
        }
        xhr.ontimeout = (p) => {
          console.error('on timeout', p)
        }
        xhr.onload = () => {
          try {
            const x = JSON.parse(xhr.response)
            for (let i = 0; i < x.length; i++) {
              q[i][1](x[i])
            }
          } catch (err) {
            console.error('something wrong with file upload', err)
            q.forEach(([, , reject]) => {
              // tmp
              reject(err)
            })
          }
        }
        xhr.open('POST', url + '/' + functionName)
        xhr.setRequestHeader('Content-Type', 'multipart/form-data')
        xhr.setRequestHeader('Authorization', authorization)
        xhr.send(body)
      } catch (err) {
        /* handle error */
        console.error('Something wrong with xhr upload', err)
      }
    }, 500)
  }
}

export default async (
  client: BasedClient,
  functionName: string,
  options: StreamFunctionContents<File>
) => {
  console.info('😍 staged:', options.contents.name)

  if (!client.connected) {
    await client.once('connect')
  }
  console.info('connected done!', options.contents.name)

  // key is something special

  if (!queue[functionName]) {
    queue[functionName] = []
  }

  return new Promise((resolve, reject) => {
    queue[functionName].push([options, resolve, reject])
    drainQueue(client, functionName, encodeAuthState(client.authState))
  })
}
