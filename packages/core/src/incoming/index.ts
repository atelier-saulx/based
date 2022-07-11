import { BasedCoreClient } from '..'

export const incoming = (client: BasedCoreClient, data) => {
  try {
    const x = JSON.parse(data.data)
    if (x.id) {
      if (client.functionResponseListeners[x.id]) {
        client.functionResponseListeners[x.id][0](x.msg)
        delete client.functionResponseListeners[x.id]
      }
    }
  } catch (err) {
    console.error('cannot parse dat json', err)
  }
}
