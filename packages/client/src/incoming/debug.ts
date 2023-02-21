import { BasedClient } from '..'

export const debugFunction = (
  client: BasedClient,
  payload: any,
  id: number
) => {
  client.emit('debug', {
    type: 'function',
    direction: 'incoming',
    payload,
    id,
  })
}

export const debugDiff = (client: BasedClient, payload: any, id: number) => {
  client.emit('debug', {
    type: 'subscriptionDiff',
    direction: 'incoming',
    id,
    payload,
  })
}
