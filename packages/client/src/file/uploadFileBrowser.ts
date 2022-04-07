import { Based } from '..'

const inProgress: { [url: string]: boolean } = {}
const queue: {
  [url: string]: {
    file: File
    id: string
    name?: string
    raw: boolean
    url: string
    functionName?: string
  }[]
} = {}

const drainQueue = (url: string, authorization: string) => {
  if (!inProgress[url]) {
    inProgress[url] = true
    setTimeout(() => {
      console.info('Drain file q')
      inProgress[url] = false
      const q = queue[url]
      queue[url] = []
      const body = new global.FormData()
      for (const f of q) {
        const { raw, name, id, file, functionName } = f
        const meta = `${functionName || ''}|${raw ? 1 : 0}|${id}|${file.size}${
          name ? `|${name}` : ''
        }`

        body.append(meta, file)
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
          let res: any = {}
          try {
            res = JSON.parse(xhr.response)
            console.info('SUCCESS', res)
          } catch (err) {
            console.error('something wrong with file upload', err)
          }
        }
        xhr.open('POST', url + '/file')
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
  client: Based,
  file: File,
  url: string,
  id: string,
  raw: boolean,
  name?: string,
  functionName?: string
) => {
  if (!queue[url]) {
    queue[url] = []
  }
  queue[url].push({
    file,
    id,
    url,
    raw,
    name,
    functionName,
  })
  drainQueue(url, client.getToken())
}
