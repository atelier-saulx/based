import { StreamFunctionContents, StreamResponseHandler } from './types.js'
import { BasedClient } from '../index.js'
import { addStreamChunk, addStreamRegister } from '../outgoing/index.js'

const waitForChunk = (reader: FileReader): Promise<Uint8Array> => {
  return new Promise((resolve) => {
    reader.addEventListener('loadend', (e) => {
      resolve(new Uint8Array(reader.result as ArrayBuffer))
    })
  })
}

export const uploadFile = async (
  client: BasedClient,
  name: string,
  options: StreamFunctionContents<File>,
  progressListener?: (p: number, bytes: number) => void,
): Promise<any> => {
  if (!(options.contents instanceof File)) {
    throw new Error('File Contents has to be an instance of "File"')
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
    options.size!,
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

  let readSize = Math.min(medium, options.size!)
  if (options.size! < medium * 5) {
    readSize = Math.min(smallest, options.size!)
  } else if (options.size! > medium * 100) {
    readSize = maxSize
  }

  let streamHandler: StreamResponseHandler

  const waitForStream = () => {
    return new Promise((resolve) => {
      streamHandler[2] = (
        seqId: number,
        code: number,
        maxChunkSize: number,
      ) => {
        if (maxChunkSize) {
          readSize = maxChunkSize
        }
        resolve({ seqId, maxChunkSize, code })
      }
    })
  }

  async function* loadFileInChunks(file: File) {
    let totalBytes = 0
    while (totalBytes < file.size) {
      const end = Math.min(totalBytes + file.size, totalBytes + readSize)
      const chunk = file.slice(totalBytes, end)
      const reader = new FileReader()
      reader.readAsArrayBuffer(chunk)
      const result = await waitForChunk(reader)
      if (seqId === 255) {
        seqId = 0
      }
      addStreamChunk(client, reqId, ++seqId, result, useDeflate)
      await waitForStream()
      totalBytes += chunk.size
      yield totalBytes
    }
    yield totalBytes
  }

  let id = Math.random().toString(16)
  const dcHandler = () => {
    // console.error('CLIENT DC -> ABORT STREAM', Date.now(), id)
  }

  client.once('disconnect', dcHandler)

  return new Promise(async (resolve, reject) => {
    streamHandler = [resolve, reject, () => {}]
    client.streamFunctionResponseListeners.set(reqId, streamHandler)
    for await (const read of loadFileInChunks(options.contents)) {
      if (progressListener) {
        progressListener(read / options.size!, read)
      }
    }
    client.off('disconnect', dcHandler)
  })
}
