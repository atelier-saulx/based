import { BasedClient } from '..'
import { drain } from './drain'

export const addStream = (
  client: BasedClient,
  stream: any,
  name: string,
  resolve: (response: any) => void,
  reject: (err: Error) => void
) => {
  if (client.outgoingStreams.has(name)) {
    client.outgoingStreams.set(name, [])
  }
  const outgoing = client.outgoingStreams.get(name)
  outgoing.push({
    resolve,
    reject,
    stream,
  })
  drain(client)
}
