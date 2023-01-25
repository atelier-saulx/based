import { Readable } from 'stream'
import { request } from 'http'
import { request as sslRequest } from 'https'
import { BasedClient } from '..'
import fs from 'fs'
import { promisify } from 'util'
import { FileUploadPath, FileUploadStream } from './types'

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
  options: FileUploadPath
) => {
  const info = await checkFile(options.path)
  if (info) {
    // return uploadFileStream(client, url, {
    //   contents: fs.createReadStream(options.path),
    //   mimeType: options.mimeType,
    //   extension: !options.mimeType
    //     ? options.path.match(/\.(.*?)$/)?.[1]
    //     : undefined,
    //   size: info.size,
    //   id: options.id,
    //   functionName: options.functionName,
    //   raw: options.raw,
    // })
  } else {
    throw new Error(`File does not exist ${options.path}`)
  }
}

export const uploadFileStream = (
  client: BasedClient,
  name: string,
  options: FileUploadStream
) => {
  if (!(options.contents instanceof Readable)) {
    throw new Error('File Contents has to be an instance of "Readable"')
  }

  // const [, protocol, host, port] = parseUrlRe.exec(url)

  // const headers: any = {
  //   'Content-Length': options.size,
  //   'Req-Type': 'blob',
  //   'File-Is-Raw': options.raw ? '1' : '0',
  //   'File-Id': options.id,
  //   'File-Name': options.name || '',
  //   'Function-Name': options.functionName || '',
  //   Authorization: client.getToken() || '',
  // }

  // if (options.mimeType) {
  //   headers['Content-Type'] = options.mimeType
  // } else if (options.extension) {
  //   headers['File-Extension'] = options.extension
  // } else {
  //   headers['Content-Type'] = 'text/plain'
  // }

  // const httpOptions = {
  //   port,
  //   host: host,
  //   path: '/file',
  //   method: 'POST',
  //   headers,
  // }

  // const onReady = () => {
  //   console.info('file uploaded')
  // }
  // const req =
  //   protocol === 'wss' || protocol === 'https'
  //     ? sslRequest(httpOptions, onReady)
  //     : request(httpOptions, onReady)

  // options.contents.pipe(req)
}
