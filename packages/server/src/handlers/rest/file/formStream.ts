import { DataStream } from './DataStream'
import storeFile from './storeFile'
import uws from '@based/uws'
import { BasedServer } from '../../..'
import { FileOptions } from './types'
import getExtenstion from './getExtenstion'
// import fs from 'fs'

type FileDescriptor = {
  opts: Partial<FileOptions>
  stream: DataStream
  headersSet: number
}

const isCompleteOpts = (
  options: Partial<FileOptions>
): options is FileOptions => {
  return !!(options.id && options.size && options.type && options.extension)
}

const setHeader = (
  server: BasedServer,
  file: FileDescriptor,
  res: uws.HttpResponse
): boolean => {
  file.headersSet++
  if (file.headersSet === 2) {
    const opts = file.opts
    if (isCompleteOpts(opts)) {
      if (opts.size < 200000) {
        file.stream.on('end', () => {
          const payload: any = {
            $id: opts.id,
            progress: 1,
            size: opts.size,
          }
          if (opts.name) {
            payload.name = opts.name
          }
          server.based.set(payload)
        })
      } else {
        let progress = 0
        let total = 0
        let setInProgress = false
        const payload: any = {
          $id: opts.id,
          progress: 0,
          size: opts.size,
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
        file.stream.on('end', () => {
          progress = 1
          updateProgress()
        })
        file.stream.on('data', (chunk) => {
          total += chunk.byteLength
          progress = total / opts.size
          updateProgress()
        })
      }
      storeFile(server, file.stream, opts)
    } else {
      invalidFile(res)
      return null
    }
    return true
  }
  return false
}

const invalidFile = (res: uws.HttpResponse) => {
  console.info('Invalid file')
  res.aborted = true
  res.writeStatus('400 Invalid Request').end('{"error":"invalid file}')
}

const toBuffer = (str: string, firstWritten: boolean): Buffer => {
  return Buffer.from(firstWritten ? str + '\r\n' : str, 'binary')
}

export default async (
  server: BasedServer,
  res: uws.HttpResponse
): Promise<void> => {
  const files: FileDescriptor[] = []

  let boundary = null
  let prevLine: string
  let isWriting = false

  res.onData((chunk, isLast) => {
    let firstWritten = false
    const blocks = Buffer.from(chunk).toString('binary').split('\r\n')

    if (!boundary) {
      boundary = blocks[0]
    }

    for (let i = 0; i < blocks.length; i++) {
      const line = blocks[i]

      if (!boundary) {
        continue
      }

      if (isWriting && (line === boundary || line === boundary + '--')) {
        isWriting = false
        const file = files[files.length - 1]
        if (prevLine) {
          file.stream.end(toBuffer(prevLine, firstWritten))
        } else {
          file.stream.end()
        }
        prevLine = null
        if (line === boundary + '--') {
          continue
        }
      }

      if (line === boundary && !isWriting) {
        const file = {
          stream: new DataStream(),
          headersSet: 0,
          opts: {},
        }
        files.push(file)
        // try {
        //   fs.unlinkSync('/Users/jim/Desktop/yes.png')
        // } catch (err) {}
        // file.stream.pipe(fs.createWriteStream('/Users/jim/Desktop/yes.png'))
        continue
      }

      const file = files[files.length - 1]

      if (!file) {
        return invalidFile(res)
      }

      if (!isWriting && line.includes('Content-Disposition')) {
        const meta = line.match(/name="(.*?)"/)?.[1]
        if (!meta) {
          return invalidFile(res)
        }
        const [functionName, raw, id, size, ...name] = meta.split('|')
        const opts = file.opts
        opts.id = id
        if (raw) {
          opts.raw = true
        }
        if (name && name.length) {
          opts.name = name.join('|')
        } else {
          opts.name = line.match(/filename="(.*?)"/)?.[1] || 'untitled'
        }
        if (functionName) {
          opts.functionName = functionName
        }
        opts.size = Number(size)
        isWriting = setHeader(server, file, res)
        if (isWriting === null) {
          return
        }
        continue
      }

      if (!isWriting && line.includes('Content-Type')) {
        const mimeType = line.match(
          /Content-Type: ([a-zA-Z0-9].+\/[a-zA-Z0-9].+)/
        )?.[1]
        if (!mimeType) {
          return invalidFile(res)
        }
        file.opts.type = mimeType
        file.opts.extension = getExtenstion(mimeType)
        isWriting = setHeader(server, file, res)
        if (isWriting === null) {
          return
        }
        continue
      }

      if (isWriting) {
        if (prevLine) {
          file.stream.write(toBuffer(prevLine, firstWritten))
        }
        prevLine = line
        firstWritten = true
      }
    }

    if (isLast) {
      res.end('{}')
    }
  })
}
