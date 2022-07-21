import { BasedCoreClient } from '..'

export const decodeHeader = (
  nr: number
): { type: number; isDeflate: boolean; len: number } => {
  const len = nr >> 4
  const meta = nr & 15
  const type = meta >> 1
  const isDeflate = meta & 1
  return {
    type,
    isDeflate: isDeflate === 1,
    len,
  }
}

export const incoming = (client: BasedCoreClient, data) => {
  console.info(data)

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
