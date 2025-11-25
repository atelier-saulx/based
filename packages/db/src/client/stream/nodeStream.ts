import { Readable, Writable } from 'stream'
import fs from 'fs'
import { promisify } from 'util'
import {
  StreamFunctionPath,
  StreamFunctionStream,
  StreamResponseHandler,
} from './types.js'
import { BasedClient } from '../index.js'
import { addStreamChunk, addStreamRegister } from '../outgoing/index.js'

const stat = promisify(fs.stat)

const checkFile = async (
  path: string,
): Promise<{ size: number } | undefined> => {
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
  options: StreamFunctionPath,
  progressListener?: (p: number, bytes: number) => void,
) => {
  const info = await checkFile(options.path)
  if (info) {
    return uploadFileStream(
      client,
      name,
      {
        contents: fs.createReadStream(options.path),
        mimeType: options.mimeType,
        extension: options.path.match(/\.(.*?)$/)?.[1],
        size: info.size,
        payload: options.payload,
        serverKey: options.serverKey,
        fileName: options.fileName,
      },
      progressListener,
    )
  } else {
    throw new Error(`File does not exist ${options.path}`)
  }
}

export const uploadFileStream = async (
  client: BasedClient,
  name: string,
  options: StreamFunctionStream,
  progressListener?: (p: number, bytes: number) => void,
): Promise<any> => {
  if (!(options.contents instanceof Readable)) {
    throw new Error('File Contents has to be an instance of "Readable"')
  }

  if (!client.connected) {
    await client.once('connect')
  }

  let reqId = ++client.streamRequestId

  if (reqId > 16777215) {
    reqId = client.streamRequestId = 0
  }

  let seqId = 0

  addStreamRegister(
    client,
    reqId,
    options.size,
    options.fileName!,
    options.mimeType!,
    options.extension!,
    name,
    options.payload,
  )

  const useDeflate = !(options.mimeType
    ? /image|video|x-zip/i.test(options.mimeType)
    : options.extension
      ? /(mp4|avi|mov|zip|jpg|jpeg|png|gif|mkv)/i.test(options.extension)
      : false)

  // 100kb
  const smallest = 100000

  // 10mb
  const maxSize = 1000000 * 10

  // 1mb
  const medium = 1000000 * 1

  let readSize = Math.min(medium, options.size)
  if (options.size < medium * 5) {
    readSize = Math.min(smallest, options.size)
  } else if (options.size > medium * 100) {
    readSize = maxSize
  }

  let bufferSize = 0
  let nextHandler: any
  let chunks: any[] = []
  let lastReceived = 0
  let totalBytes = 0
  let streamHandler: StreamResponseHandler

  const wr = new Writable({
    write: function (c, encoding, next) {
      if (c.byteLength > maxSize) {
        console.warn(
          'CHUNK SIZE LARGER THEN MAX SIZE NOT HANDLED YET',
          c.byteLength,
          maxSize,
        )
      }
      bufferSize += c.byteLength
      chunks.push(c)
      if (bufferSize >= readSize || totalBytes + bufferSize === options.size) {
        nextHandler = next
        if (seqId > 0) {
          if (lastReceived === seqId) {
            // Client is slower then server (most common)
            nextChunk(undefined)
          }
          // Else server is slower then client e.g. transcoding etc
        } else {
          setTimeout(nextChunk, 0)
        }
      } else {
        next()
      }
    },
  })

  const nextChunk = (receivedSeqId, code?: number, maxChunkSize?: number) => {
    if (receivedSeqId !== undefined) {
      if (maxChunkSize) {
        // set readSize if sefver is busy
        readSize = maxChunkSize
      }
      lastReceived = receivedSeqId
    }
    if (!nextHandler) {
      return
    }
    if (code === 1) {
      progressListener!(1, options.size)
    } else {
      const n = new Uint8Array(bufferSize)
      let c = 0
      for (const b of chunks) {
        n.set(b, c)
        c += b.length
      }
      if (progressListener) {
        progressListener(totalBytes / options.size, totalBytes)
      }
      totalBytes += bufferSize

      if (seqId === 255) {
        seqId = 0
      }

      addStreamChunk(client, reqId, ++seqId, n, useDeflate)
      bufferSize = 0
      chunks = []
      nextHandler()
      nextHandler = undefined
    }
  }

  options.contents.pipe(wr)

  let id = Math.random().toString(16)
  const dcHandler = () => {
    // HANDLE THIS
    // console.error("CLIENT DC -> ABORT STREAM", Date.now(), id);
  }

  client.once('disconnect', dcHandler)

  options.contents.on('end', () => {
    client.off('disconnect', dcHandler)
  })

  return new Promise((resolve, reject) => {
    streamHandler = [resolve, reject, nextChunk]
    client.streamFunctionResponseListeners.set(reqId, streamHandler)
  })
}
