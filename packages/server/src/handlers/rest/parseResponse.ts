import uws from '@based/uws'
import { RequestTypes, ResponseData } from '@based/client'
import { hash, hashObjectIgnoreKeyOrder } from '@saulx/hash'
import zlib from 'zlib'
import jsonexport from 'jsonexport'

const invalid = (
  res: uws.HttpResponse,
  error: any,
  statusMsg: string = 'Invald request'
) => {
  res.aborted = true
  res.writeStatus('400 ' + statusMsg)
  res.writeHeader('Access-Control-Allow-Origin', '*')
  res.writeHeader('Access-Control-Allow-Headers', 'content-type')
  res.writeHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ error, code: 400 }))
}

const ok = (res: uws.HttpResponse) => {
  res.writeStatus('200 OK')
  res.writeHeader('Access-Control-Allow-Origin', '*')
  res.writeHeader('Access-Control-Allow-Headers', 'content-type')
}

export default (
  res: uws.HttpResponse,
  payload: ResponseData | string,
  type: 0 | 1,
  version?: number,
  headers?: { [key: string]: string }
) => {
  if (res.aborted) {
    return
  }

  let result: any
  let reqType: number
  let isParsed = false

  if (headers) {
    result = payload[2]
    if (headers['Content-Type']) {
      isParsed = true
    } else if (typeof result === 'string') {
      res.writeHeader('Content-Type', 'text/plain')
      isParsed = true
    }
    if (!headers['Cache-Control']) {
      res.writeHeader('Cache-Control', 'max-age=10')
    }

    for (const key in headers) {
      res.writeHeader(key, headers[key])
    }
  } else if (typeof payload === 'string') {
    let secondIndex = 0
    let lastIndex = 0
    const len = payload.length - 1
    for (let i = 4; i < 20; i++) {
      const s = payload[i]

      if (!secondIndex && s === ',') {
        secondIndex = i
        if (lastIndex) {
          break
        }
      }

      if (!lastIndex) {
        if (payload[len - i] === ',') {
          lastIndex = len - i
          if (secondIndex) {
            break
          }
        }
      }
    }

    if (!secondIndex && !lastIndex) {
      invalid(res, 'Invalid Request')
      return
    }

    result = payload.slice(secondIndex + 1, lastIndex)

    const checksum = version || hash(result)
    ok(res)
    res.writeHeader('ETag', String(checksum))
    res.writeHeader('Cache-Control', 'max-age=0, must-revalidate')
    isParsed = true
  } else {
    reqType = payload[0]

    if (reqType === RequestTypes.Get) {
      if (payload[3]) {
        invalid(res, payload[3], 'Invalid Query')
        return
      } else {
        const r = payload[2]
        const checksum = hashObjectIgnoreKeyOrder(r)
        ok(res)
        res.writeHeader('ETag', String(checksum))
        res.writeHeader('Cache-Control', 'max-age=0, must-revalidate')
        result = r
      }
    } else if (
      reqType === RequestTypes.Set ||
      reqType === RequestTypes.Copy ||
      reqType === RequestTypes.Configuration ||
      reqType === RequestTypes.Digest ||
      reqType === RequestTypes.GetConfiguration ||
      reqType === RequestTypes.Delete
    ) {
      if (payload[3]) {
        invalid(res, payload[3])
        return
      } else {
        ok(res)
        result = payload[2]
      }
    } else if (reqType === RequestTypes.Call) {
      if (payload[3]) {
        invalid(res, payload[3])
        return
      } else {
        ok(res)
        result = payload[2]
      }
    } else if (reqType === RequestTypes.Subscription) {
      if (payload[4]) {
        invalid(res, payload[4])
        return
      } else {
        ok(res)
        res.writeHeader('ETag', String(payload[3]))
        res.writeHeader('Cache-Control', 'max-age=0, must-revalidate')
        result = payload[2]
      }
    } else {
      invalid(res, 'Invalid Request')
    }
  }

  if (!headers) {
    if (reqType === RequestTypes.Digest) {
      res.writeHeader('Content-Type', 'text/plain')
    } else {
      if (type === 1) {
        res.writeHeader('Content-Type', 'text/csv')
      } else {
        res.writeHeader('Content-Type', 'application/json')
      }
    }
  }

  if (result !== undefined) {
    let parsed
    let csvParser

    if (type === 0) {
      parsed = isParsed ? result : JSON.stringify(result)
    } else {
      csvParser = jsonexport()
    }

    if (!headers?.['Content-Encoding'] && res.acceptEncoding) {
      const acceptEncoding = res.acceptEncoding
      let compressor
      if (acceptEncoding.includes('deflate')) {
        res.writeHeader('Content-Encoding', 'deflate')
        compressor = zlib.createDeflate()
      } else if (acceptEncoding.includes('gzip')) {
        res.writeHeader('Content-Encoding', 'gzip')
        compressor = zlib.createGzip()
      } else if (acceptEncoding.includes('br')) {
        res.writeHeader('Content-Encoding', 'br')
        compressor = zlib.createBrotliCompress()
      }
      if (compressor) {
        compressor.on('data', (buffer) => {
          if (!res.aborted) {
            res.write(
              buffer.buffer.slice(
                buffer.byteOffset,
                buffer.byteOffset + buffer.byteLength
              )
            )
          }
        })
        compressor.on('end', () => {
          if (!res.aborted) {
            res.end()
          }
        })
        if (csvParser) {
          if (!res.aborted) {
            csvParser.pipe(compressor)
            csvParser.write(
              Buffer.from(isParsed ? result : JSON.stringify(result))
            )
            csvParser.end()
          }
        } else {
          if (!res.aborted) {
            compressor.write(Buffer.from(parsed))
            compressor.end()
          }
        }
        return
      }
    }
    if (csvParser) {
      csvParser.on('end', () => {
        console.info('end')
        if (!res.aborted) {
          res.end()
        }
      })
      csvParser.on('data', (buffer) => {
        if (!res.aborted) {
          res.write(
            buffer.buffer.slice(
              buffer.byteOffset,
              buffer.byteOffset + buffer.byteLength
            )
          )
        }
      })
      if (!res.aborted) {
        csvParser.write(Buffer.from(isParsed ? result : JSON.stringify(result)))
        csvParser.end()
      }
    } else {
      if (!res.aborted) {
        res.end(parsed)
      }
    }
  } else {
    if (!res.aborted) {
      res.end()
    }
  }
  // fix
  res.client = null
}
