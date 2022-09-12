/*

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
*/
