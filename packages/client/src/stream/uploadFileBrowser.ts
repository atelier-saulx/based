import { BasedClient, encodeAuthState } from '..'
import { StreamFunctionContents } from './types'
import getUrlFromOpts from '../getUrlFromOpts'
import { convertDataToBasedError, BasedErrorCode } from '../types/error'
const inProgress: { [url: string]: boolean } = {}

type QueueItem = {
  options: StreamFunctionContents<File>
  resolve: (x: any) => void
  reject: (err: Error) => void
  progressListener?: (progress: number) => void
}

const queue: {
  [functionName: string]: QueueItem[]
} = {}

const getUrl = async (client: BasedClient): Promise<string> => {
  let url = await getUrlFromOpts(client.opts)
  if (typeof url === 'function') {
    url = await url()
  }
  return url.replace(/^ws/, 'http')
}

const reject = (err: Error, q: QueueItem[]) => {
  q.forEach((item) => {
    item.reject(err)
  })
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
        const options = q[i].options
        const { contents, payload } = options
        const p = payload || {}
        body.append(`size=${contents.size},${JSON.stringify(p)}`, contents)
      }
      try {
        const xhr = new global.XMLHttpRequest()
        xhr.upload.onprogress = (p: ProgressEvent) => {
          const progress =
            // @ts-ignore
            (p.loaded || p.position) / (p.totalSize || p.total)
          q.forEach((item) => {
            if (item.progressListener) {
              item.progressListener(progress)
            }
          })
        }
        xhr.onerror = (p) => {
          if (xhr.status === 0 && !xhr.statusText) {
            const err = convertDataToBasedError({
              message: `[${functionName}] Function not found`,
              code: BasedErrorCode.FunctionNotFound,
            })
            reject(err, q)
          } else {
            // go handle this!
            console.error(p)
          }
        }
        xhr.timeout = 1e3 * 60 * 60 * 24
        xhr.onabort = () => {
          const err = new Error('File upload aborted before it finished')
          reject(err, q)
        }
        xhr.ontimeout = () => {
          console.error('on timeout')
        }
        xhr.onload = () => {
          try {
            const x = JSON.parse(xhr.response)
            // go handle errors here?

            console.log('???', x)
            for (let i = 0; i < x.length; i++) {
              q[i].resolve(x[i])
            }
          } catch (err) {
            reject(err, q)
          }
        }
        xhr.open('POST', url + '/' + functionName)
        xhr.setRequestHeader('Content-Type', 'multipart/form-data')
        xhr.setRequestHeader('Authorization', authorization)
        xhr.send(body)
      } catch (err) {
        console.warn('Something unexpected happened with file upload', err)
        reject(err, q)
      }
    }, 500)
  }
}

export default async (
  client: BasedClient,
  functionName: string,
  options: StreamFunctionContents<File>,
  progressListener?: (progress: number) => void
) => {
  if (!client.connected) {
    await client.once('connect')
  }

  // TODO: key is something special
  if (!queue[functionName]) {
    queue[functionName] = []
  }

  return new Promise((resolve, reject) => {
    queue[functionName].push({ options, resolve, reject, progressListener })
    drainQueue(client, functionName, encodeAuthState(client.authState))
  })
}
