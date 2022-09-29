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
  [BasedErrorCode.AuthorizeError]: { code: 403, status: 'Forbidden' },
  [BasedErrorCode.AuthorizeRejectedError]: { code: 403, status: 'Forbidden' },
  [BasedErrorCode.InvalidPayload]: { code: 400, status: 'Bad Request' },
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
  const defaultProps = { ...(defaultCodes[basedErrorCode] || {}), ...props }
  const { code, status } = defaultProps
  client.res.writeStatus(`${code} ${status}`)
  client.res.writeHeader('Access-Control-Allow-Origin', '*')
  client.res.writeHeader('Access-Control-Allow-Headers', 'content-type')
  client.res.writeHeader('Content-Type', 'application/json')
  end(
    client,
    JSON.stringify({ error: error || defaultMessages[basedErrorCode], code })
  )
}

export const sendErrorRaw = (
  res: uws.HttpResponse,
  error: any,
  code: number = 400,
  status: string = 'Bad Request'
) => {
  res.writeStatus(`${code} ${status}`)
  res.writeHeader('Access-Control-Allow-Origin', '*')
  res.writeHeader('Access-Control-Allow-Headers', 'content-type')
  res.writeHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ error, code }))
}

export const sendHttpResponse = (client: HttpClient, result: any) => {
  if (!client.res) {
    return
  }

  const encoding = client.context.encoding

  client.res.writeStatus('200 OK')
  // for functions there is never cache (idea is they are used to execute - observable fns are for cache)
  client.res.writeHeader('Cache-Control', 'max-age=0, must-revalidate')
  let parsed: string
  if (typeof result === 'string') {
    client.res.writeHeader('Content-Type', 'text/plain')
    parsed = result
  } else {
    client.res.writeHeader('Content-Type', 'application/json')
    parsed = JSON.stringify(result)
  }
  compress(client, parsed, encoding).then((p) => end(client, p))
}
