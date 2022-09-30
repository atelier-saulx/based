import { HttpClient } from '../../types'
import uws from '@based/uws'
import end from './end'
import { compress } from './compress'
import { BasedErrorCode, defaultMessages } from '../../error'

export const defaultCodes = {
  [BasedErrorCode.FunctionError]: {
    code: 500,
    status: 'Internal Server Error',
  },
  [BasedErrorCode.FunctionNotFound]: { code: 404, status: 'Not Found' },
  [BasedErrorCode.CannotStreamToObservableFunction]: {
    code: 404,
    status: 'Not Found',
  },
  [BasedErrorCode.AuthorizeFunctionError]: { code: 403, status: 'Forbidden' },
  [BasedErrorCode.AuthorizeRejectedError]: { code: 403, status: 'Forbidden' },
  [BasedErrorCode.InvalidPayload]: { code: 400, status: 'Bad Request' },
  [BasedErrorCode.PayloadTooLarge]: { code: 413, status: 'Payload Too Large' },
  [BasedErrorCode.ChunkTooLarge]: { code: 413, status: 'Payload Too Large' },
  [BasedErrorCode.UnsupportedContentEncoding]: {
    code: 400,
    statis: 'Incorrect content encoding',
  },
  [BasedErrorCode.LengthRequired]: { code: 411, status: 'Length Required' },
  [BasedErrorCode.MethodNotAllowed]: {
    code: 405,
    status: 'Method Not Allowed',
  },
}

export const sendHttpError = (
  client: HttpClient,
  basedErrorCode: BasedErrorCode,
  // code: number = 400,
  // status: string = 'Bad Request'
  error?: any,
  props?: { code?: number; status?: string }
) => {
  if (!client.res) {
    return
  }
  client.res.cork(() => {
    const defaultProps = { ...(defaultCodes[basedErrorCode] || {}), ...props }
    const { code, status } = defaultProps

    // fix them status

    client.res.writeStatus(`${code} ${status}`)
    client.res.writeHeader('Access-Control-Allow-Origin', '*')
    client.res.writeHeader('Access-Control-Allow-Headers', 'content-type')
    client.res.writeHeader('Content-Type', 'application/json')
    end(
      client,
      JSON.stringify({ error: error || defaultMessages[basedErrorCode], code })
    )
  })
}

export const sendErrorRaw = (
  res: uws.HttpResponse,
  error: any,
  code: number = 400,
  status: string = 'Bad Request'
) => {
  res.cork(() => {
    res.writeStatus(`${code} ${status}`)
    res.writeHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error, code }))
  })
}

export const sendHttpResponse = (client: HttpClient, result: any) => {
  if (!client.res) {
    return
  }

  const encoding = client.context.encoding

  let cType: string

  // for functions there is never cache (idea is they are used to execute - observable fns are for cache)
  let parsed: string
  if (typeof result === 'string') {
    cType = 'text/plain'
    parsed = result
  } else {
    cType = 'application/json'
    parsed = JSON.stringify(result)
  }
  compress(client, parsed, encoding).then(({ payload, encoding }) => {
    if (client.res) {
      client.res.cork(() => {
        client.res.writeStatus('200 OK')
        client.res.writeHeader('Cache-Control', 'max-age=0, must-revalidate')
        client.res.writeHeader('Content-Type', cType)
        if (encoding) {
          client.res.writeHeader('Content-Encoding', encoding)
        }
        end(client, payload)
      })
    }
  })
}
