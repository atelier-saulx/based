import uws from '@based/uws'

const invalidReq = (res: uws.HttpResponse) => {
  res.aborted = true
  res
    .writeStatus('400 Invalid Request')
    .writeHeader('Access-Control-Allow-Origin', '*')
    .writeHeader('Access-Control-Allow-Headers', 'content-type')
    .end(`{"code":400,"error":"Invalid Request"}`)
}

export const invalidReqNoCors = (res: uws.HttpResponse) => {
  res.aborted = true
  res
    .writeStatus('400 Invalid Request')
    .end(`{"code":400,"error":"Invalid Request"}`)
}

export default invalidReq
