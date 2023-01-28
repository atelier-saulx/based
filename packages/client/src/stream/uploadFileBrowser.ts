import { BasedClient, encodeAuthState } from '..'
import { StreamFunctionContents } from './types'
import getUrlFromOpts from '../getUrlFromOpts'
// import { parsePayload } from './parsePayload'
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
      console.info('Drain file q')
      inProgress[functionName] = false

      const url = await getUrl(client)

      const q = queue[functionName]
      queue[functionName] = []
      const body = new global.FormData()
      for (const options of q) {
        const { contents, payload, mimeType } = options[0]
        const meta = `${mimeType}|${contents.size}|${JSON.stringify(payload)}`
        body.append(meta, contents)
      }
      try {
        const xhr = new global.XMLHttpRequest()
        xhr.upload.onprogress = (p: ProgressEvent) => {
          const progress =
            // @ts-ignore
            (100 * (p.loaded || p.position)) / (p.totalSize || p.total)
          console.info(progress, 'upload...')
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
  if (!client.connected) {
    await client.once('connect')
  }

  // key is something special

  if (!queue[functionName]) {
    queue[functionName] = []
  }

  return new Promise((resolve, reject) => {
    queue[functionName].push([options, resolve, reject])
    drainQueue(client, functionName, encodeAuthState(client.authState))
  })
}
