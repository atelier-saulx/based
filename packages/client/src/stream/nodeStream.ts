import { Readable } from 'stream'
import { IncomingMessage, request } from 'http'
import { request as sslRequest } from 'https'
import fs from 'fs'
import { promisify } from 'util'
import {
  StreamFunctionPath,
  StreamFunctionStream,
  StreamHeaders,
} from './types'
import { BasedClient, encodeAuthState } from '..'
import getUrlFromOpts from '../getUrlFromOpts'
import { parsePayload } from './parsePayload'
import { convertDataToBasedError } from '../types/error'

const stat = promisify(fs.stat)

const checkFile = async (path: string): Promise<{ size: number } | null> => {
  try {
    const s = await stat(path)
    return {
      size: s.size,
    }
  } catch (err) {}
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
      contentLength: info.size,
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
  headers: StreamHeaders
) => {
  const [, protocol, host, port] = parseUrlRe.exec(url)

  const httpOptions = {
    port,
    host: host,
    path: '/' + name,
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
        } catch (err) {}
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
  let url = await getUrlFromOpts(client.opts)
  if (typeof url === 'function') {
    url = await url()
  }

  const headers: StreamHeaders = {
    'Content-Length': String(options.contentLength),
    'Content-Type': options.mimeType || 'text/plain',
    Authorization: encodeAuthState(client.authState),
  }

  if (!options.mimeType && options.extension) {
    headers['Content-Extension'] = options.extension
  }

  if (options.payload) {
    headers.Payload = parsePayload(options.payload)
  }

  return streamRequest(options.contents, name, url, headers)
}
