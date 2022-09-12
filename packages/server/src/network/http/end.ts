import { HttpClient } from '../../types'

export default (client: HttpClient, payload?: string | Buffer) => {
  if (client.res) {
    if (payload === undefined) {
      client.res.end()
    } else {
      client.res.end(payload)
    }
    client.res = null
    client.context = null
  }
}
