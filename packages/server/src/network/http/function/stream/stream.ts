import { DataStream } from './DataStream'
import uws from '@based/uws'

const smallFile = (res: uws.HttpResponse, stream: DataStream) => {
  stream.emit('progress', 0)
  res.onData(async (chunk, isLast) => {
    const buf = Buffer.from(chunk)
    stream.write(buf)
    if (isLast) {
      stream.emit('progress', 1)
      stream.end()
      res.end(`{}`)
    }
  })
}

const largeFile = (res: uws.HttpResponse, stream: DataStream, size: number) => {
  let progress = 0
  let total = 0
  let setInProgress = false

  stream.emit('progress', progress)

  res.onData(async (chunk, isLast) => {
    const buf = Buffer.from(chunk)
    total += buf.byteLength
    progress = total / size

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
      res.end(`{}`)
    }
  })
}

export default async (
  res: uws.HttpResponse,
  size: number
): Promise<DataStream> => {
  const stream = new DataStream()
  if (size > 200000) {
    largeFile(res, stream, size)
  } else {
    smallFile(res, stream)
  }
  return stream
}
