import { Readable } from 'stream'
import { IncomingMessage, request } from 'http'
import { request as sslRequest } from 'https'
import fs from 'fs'
import { promisify } from 'util'
import {
  StreamFunctionPath,
  StreamFunctionStream,
  StreamHeaders,
} from './types.js'
import { BasedClient, encodeAuthState } from '../index.js'
import parseOpts from '@based/opts'
import { serializeQuery } from '@saulx/utils'
import { convertDataToBasedError } from '@based/errors'

const stat = promisify(fs.stat)

const checkFile = async (path: string): Promise<{ size: number } | null> => {
  try {
    const s = await stat(path)
    return {
      size: s.size,
    }
  } catch (err) { }
}

export const isStream = (contents: any): contents is Readable => {
  return contents instanceof Readable
}

const parseUrlRe = /^(?:(tcp|wss?|https?):\/\/)?([a-z0-9.-]*)(?::(\d+))?$/

export const uploadFilePath = async (
  client: BasedClient,
  name: string,
  options: StreamFunctionPath
) => {
  const info = await checkFile(options.path)
  if (info) {
    return uploadFileStream(client, name, {
      contents: fs.createReadStream(options.path),
      mimeType: options.mimeType,
      extension: options.path.match(/\.(.*?)$/)?.[1],
      size: info.size,
      payload: options.payload,
      serverKey: options.serverKey,
    })
  } else {
    throw new Error(`File does not exist ${options.path}`)
  }
}

const streamRequest = (
  stream: Readable,
  name: string,
  url: string,
  headers: StreamHeaders,
  query: string
) => {
  const [, protocol, host, port] = parseUrlRe.exec(url)
  // query
  const httpOptions = {
    port,
    host: host,
    path: '/' + name + query,
    method: 'POST',
    headers,
  }

  return new Promise((resolve, reject) => {
    const incomingReady = (incomingReq: IncomingMessage) => {
      const s: string[] = []
      incomingReq.on('data', (c) => {
        s.push(c.toString())
      })
      incomingReq.once('end', () => {
        const result = s.join('')
        try {
          const parsed = JSON.parse(result)
          if ('code' in parsed && 'error' in parsed) {
            reject(
              convertDataToBasedError({
                code: parsed.code,
                message: parsed.error,
              })
            )
            return
          }
          resolve(parsed)
        } catch (err) { }
        resolve(result)
      })
    }

    const req =
      protocol === 'wss' || protocol === 'https'
        ? sslRequest(httpOptions, incomingReady)
        : request(httpOptions, incomingReady)

    stream.pipe(req)
  })
}

export const uploadFileStream = async (
  client: BasedClient,
  name: string,
  options: StreamFunctionStream
): Promise<any> => {
  if (!(options.contents instanceof Readable)) {
    throw new Error('File Contents has to be an instance of "Readable"')
  }

  if (!client.connected) {
    await client.once('connect')
  }

  // key is something special
  const url = await parseOpts(client.opts, true)

  const headers: StreamHeaders = {
    'Content-Length': String(options.size),
    'Content-Type': options.mimeType || 'text/plain',
    Authorization: encodeAuthState(client.authState),
  }

  if (options.fileName) {
    headers['Content-Name'] = options.fileName
  }

  if (!options.mimeType && options.extension) {
    headers['Content-Extension'] = options.extension
  }

  let q = ''
  if (options.payload) {
    q = '?' + serializeQuery(options.payload)
  }

  return streamRequest(options.contents, name, url, headers, q)
}
