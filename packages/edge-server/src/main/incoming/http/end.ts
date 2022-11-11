import { HttpClient } from '../../../types'

export default (client: HttpClient, payload?: string | Buffer | Uint8Array) => {
  if (client.res) {
    client.res.writeHeader('Access-Control-Allow-Origin', '*')
    // only allowed headers
    client.res.writeHeader('Access-Control-Allow-Headers', '*')
    if (payload === undefined) {
      client.res.end()
    } else {
      client.res.end(payload)
    }
    client.res = null
    client.req = null
    client.context = null
  }
}
