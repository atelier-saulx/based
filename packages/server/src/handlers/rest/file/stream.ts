import { DataStream } from './DataStream'
import storeFile from './storeFile'
import uws from '@based/uws'
import { BasedServer } from '../../..'
import { FileOptions } from './types'
import { Params } from '../../../Params'
import { Client } from '../../../Client'

const smallFile = (
  server: BasedServer,
  res: uws.HttpResponse,
  stream: DataStream,
  opts: FileOptions
) => {
  res.onData(async (chunk, isLast) => {
    const buf = Buffer.from(chunk)
    stream.write(buf)
    if (isLast) {
      const payload: any = {
        $id: opts.id,
        progress: 1,
        size: opts.size,
        status: 3,
        statusText: 'ready',
      }
      if (opts.name) {
        payload.name = opts.name
      }
      server.based.set(payload)
      // this progress done after upload to s3
      stream.end()
      res.end(`{}`)
    }
  })
}

const largeFile = (
  server: BasedServer,
  res: uws.HttpResponse,
  stream: DataStream,
  opts: FileOptions
) => {
  let progress = 0
  let total = 0
  let setInProgress = false

  const payload: any = {
    $id: opts.id,
    progress: 0,
    size: opts.size,
    status: 1,
    statusText: 'uploading',
  }

  if (opts.name) {
    payload.name = opts.name
  }

  server.based.set(payload)

  const updateProgress = () => {
    if (!setInProgress) {
      setInProgress = true
      setTimeout(() => {
        const payload: any = {
          $id: opts.id,
          progress,
        }
        server.based.set(payload)
        setInProgress = false
      }, 250)
    }
  }

  res.onData(async (chunk, isLast) => {
    const buf = Buffer.from(chunk)
    total += buf.byteLength
    progress = total / opts.size
    updateProgress()
    stream.write(buf)
    if (isLast) {
      stream.end()
      // this progress done after upload to s3
      res.end(`{}`)
    }
  })
}

export default async (
  server: BasedServer,
  res: uws.HttpResponse,
  opts: FileOptions
): Promise<void> => {
  const stream = new DataStream()
  if (opts.size > 200000) {
    largeFile(server, res, stream, opts)
  } else {
    smallFile(server, res, stream, opts)
  }

  const fnName = opts.functionName

  if (fnName) {
    try {
      const fn = await server.getFunction(fnName)
      if (fn.observable === false) {
        if (res.client) {
          res.client = new Client(server, undefined, res)
        }

        await fn.function(
          new Params(
            server,
            opts,
            res.client,
            [],
            undefined,
            fnName,
            'file-upload',
            false,
            stream
          )
        )
      } else {
        throw new Error(
          'Cannot stream a file to an observable function ' + fnName
        )
      }
    } catch (err) {}
  } else {
    await storeFile(server, stream, opts)
  }
}
