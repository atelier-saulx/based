import { BasedErrorCode, convertDataToBasedError } from '@based/errors'
import { BasedClient, encodeAuthState } from '../index.js'
import { StreamFunctionContents, ProgressListener } from './types.js'
import parseOpts from '@based/opts'
const inProgress: { [url: string]: boolean } = {}

type QueueItem = {
  options: StreamFunctionContents<File>
  resolve: (x: any) => void
  reject: (err: Error) => void
  progressListener?: ProgressListener
}

export const isStreaming = {
  streaming: false,
}

const queue: {
  [functionName: string]: QueueItem[]
} = {}

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

    isStreaming.streaming = true

    setTimeout(async () => {
      inProgress[functionName] = false
      const url = await parseOpts(client.opts, true)
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
              item.progressListener(progress, q.length)
            }
          })
        }
        xhr.onerror = (p) => {
          console.error('Based xhr error', p)
          if (xhr.status === 0 && !xhr.statusText) {
            const err = convertDataToBasedError({
              message: `[${functionName}] XHR Error`,
              code: BasedErrorCode.FunctionError,
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
            for (let i = 0; i < x.length; i++) {
              const result = x[i]
              if (result.error) {
                q[i].reject(convertDataToBasedError(result.error))
              } else {
                q[i].resolve(x[i].value)
              }
            }
          } catch (err) {
            reject(err, q)
          }
          isStreaming.streaming = false
        }
        xhr.open('POST', url + '/' + functionName, true)
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
  progressListener?: ProgressListener
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
