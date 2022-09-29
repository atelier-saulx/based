import { DataStream } from './DataStream'
import { HttpClient } from '../../../types'
import { sendHttpError } from '../send'
import { BasedErrorCode } from '../../../error'

// uncompress incoming

const smallFile = (client: HttpClient, stream: DataStream, size: number) => {
  stream.emit('progress', 0)
  let total = 0
  client.res.onData(async (chunk, isLast) => {
    const buf = Buffer.from(chunk)
    total += buf.length

    if (total > size) {
      stream.destroy()
      sendHttpError(
        client,
        BasedErrorCode.InvalidPayload,
        'Payload Too Large',
        { code: 413 }
      )
      // sendHttpError(client, 'Payload Too Large', 413)
      return
    }

    stream.write(buf)
    if (isLast) {
      stream.emit('progress', 1)
      stream.end()
    }
  })
}

const largeFile = (client: HttpClient, stream: DataStream, size: number) => {
  let progress = 0
  let total = 0
  let setInProgress = false

  stream.emit('progress', progress)

  client.res.onData(async (chunk, isLast) => {
    const buf = Buffer.from(chunk)
    total += buf.byteLength
    progress = total / size

    if (total > size) {
      stream.destroy()
      sendHttpError(
        client,
        BasedErrorCode.InvalidPayload,
        'Payload Too Large',
        { code: 413 }
      )
      // sendHttpError(client, 'Payload Too Large', 413)
      return
    }

    if (!setInProgress) {
      setInProgress = true
      setTimeout(() => {
        stream.emit('progress', progress)
        setInProgress = false
      }, 250)
    }

    stream.write(buf)
    if (isLast) {
      stream.end()
    }
  })
}

export default (client: HttpClient, size: number): DataStream => {
  const stream = new DataStream()
  if (size > 200000) {
    largeFile(client, stream, size)
  } else {
    smallFile(client, stream, size)
  }
  return stream
}
