import { BasedClient } from '..'

const getSubName = (client: BasedClient, id: number): string => {
  const sub = client.observeState.get(id)
  return sub?.name || '[Cannot find name]'
}

const getChannelame = (client: BasedClient, id: number): string => {
  const sub = client.channelState.get(id)
  return sub?.name || '[Cannot find name]'
}

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

export const debugDiff = (
  client: BasedClient,
  payload: any,
  id: number,
  corrupt?: boolean
) => {
  if (corrupt) {
    client.emit('debug', {
      type: 'subscriptionDiff',
      direction: 'incoming',
      id,
      payload,
      name: getSubName(client, id),
      msg: 'Cannot apply corrupt patch',
    })
    return
  }
  client.emit('debug', {
    type: 'subscriptionDiff',
    direction: 'incoming',
    id,
    payload,
    name: getSubName(client, id),
  })
}

export const debugGet = (client: BasedClient, id: number) => {
  client.emit('debug', {
    type: 'get',
    direction: 'incoming',
    id,
  })
}

export const debugSubscribe = (
  client: BasedClient,
  id: number,
  payload: any,
  found: boolean
) => {
  client.emit('debug', {
    type: 'subscribe',
    direction: 'incoming',
    id,
    payload,
    name: getSubName(client, id),
    ...(!found ? { msg: 'Cannot find subscription handler' } : undefined),
  })
}

export const debugAuth = (client: BasedClient, payload: any) => {
  client.emit('debug', {
    type: 'auth',
    direction: 'incoming',
    payload,
  })
}

export const debugError = (client: BasedClient, payload: any) => {
  client.emit('debug', {
    type: 'error',
    direction: 'incoming',
    payload,
  })
}

export const debugChannel = (
  client: BasedClient,
  id: number,
  payload: any,
  found: boolean
) => {
  client.emit('debug', {
    type: 'channelMessage',
    direction: 'incoming',
    payload,
    id,
    name: getChannelame(client, id),
    ...(!found ? { msg: 'Cannot find channel handler' } : undefined),
  })
}
