import uws from '@based/uws'

const MAX_BODY_SIZE = 4 ** 20 // 2MB

export default (
  res: uws.HttpResponse,
  contentType: string,
  // add more later...
  onData: (data: any | void) => void
) => {
  let data = Buffer.from([])
  res.onData(async (chunk, isLast) => {
    if (res.aborted) {
      return
    }
    data = Buffer.concat([data, Buffer.from(chunk)])
    // data += Buffer.from(chunk).toString('utf8')
    if (data.length > MAX_BODY_SIZE) {
      res.writeStatus('413 Payload Too Large')
      res.writeHeader('Access-Control-Allow-Origin', '*')
      res.writeHeader('Access-Control-Allow-Headers', 'content-type')
      res.end(`{"code":413,"error":"Payload Too Large"}`)
      res.aborted = true
      return
    }
    if (isLast) {
      let params
      const str = data.toString()
      if (contentType === 'application/json') {
        try {
          params = data.length ? JSON.parse(str) : undefined
          onData(params)
        } catch (e) {
          console.error(e, str)
          res.aborted = true
          res.writeStatus('400 Invalid Request')
          res.writeHeader('Access-Control-Allow-Origin', '*')
          res.writeHeader('Access-Control-Allow-Headers', 'content-type')
          res.end(`{"code":400,"error":"Invalid payload"}`)
        }
      } else {
        onData(str)
      }
    }
  })
}
