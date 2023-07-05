import { BasedDbClient } from '.'

export const incoming = async (
  client: BasedDbClient,
  data: any /* TODO: type */
) => {
  console.log('luzzzl', data)
  if (client.isDestroyed) {
    return
  }
  const id = 0 // SEQ ID
  const payload = 0
  try {
    if (client.commandResponseListeners.has(id)) {
      client.commandResponseListeners.get(id)[0](payload)
      client.commandResponseListeners.delete(id)
    }
    // ---------------------------------
  } catch (err) {
    console.error('Error parsing incoming data', err)
  }
}
