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
import { convertDataToBasedError } from '../types/index.js'
import { serializeQuery } from '@saulx/utils'

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

  let q = ''
  if (options.payload) {
    q = '?' + serializeQuery(options.payload)
  }
}
