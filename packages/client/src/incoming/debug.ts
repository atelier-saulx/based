import { BasedClient } from '..'

const getInfo = (
  client: BasedClient,
  id: number,
  type: 'channel' | 'sub'
): { name: string; payload?: any; id: number } => {
  const sub =
    type === 'sub' ? client.observeState.get(id) : client.channelState.get(id)
  if (!sub) {
    return { name: `[Cannot find ${id}]`, id }
  }
  return sub.payload
    ? { name: sub.name, payload: sub.payload, id }
    : { name: sub.name, id }
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
    info: { id },
  })
}

export const debugDiff = (
  client: BasedClient,
  payload: any,
  id: number,
  checksum: number,
  corrupt?: boolean
) => {
  if (corrupt) {
    client.emit('debug', {
      type: 'subscriptionDiff',
      direction: 'incoming',
      payload,
      checksum,
      info: getInfo(client, id, 'sub'),
      msg: 'Cannot apply corrupt patch',
    })
    return
  }
  client.emit('debug', {
    type: 'subscriptionDiff',
    direction: 'incoming',
    id,
    checksum,
    payload,
    info: getInfo(client, id, 'sub'),
  })
}

export const debugGet = (client: BasedClient, id: number) => {
  client.emit('debug', {
    type: 'get',
    direction: 'incoming',
    info: { id },
    msg: 'Cache is up to date',
  })
}

export const debugSubscribe = (
  client: BasedClient,
  id: number,
  payload: any,
  checksum: number,
  found: boolean
) => {
  client.emit('debug', {
    type: 'subscribe',
    direction: 'incoming',
    payload,
    checksum,
    info: getInfo(client, id, 'sub'),
    ...(!found ? { msg: 'Cannot find subscription handler' } : undefined),
  })
}

export const debugAuth = (client: BasedClient, payload: any) => {
  client.emit('debug', {
    type: 'auth',
    direction: 'incoming',
    payload,
    info: {},
  })
}

export const debugError = (client: BasedClient, payload: any) => {
  client.emit('debug', {
    type: 'error',
    direction: 'incoming',
    payload,
    info: {},
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
    info: getInfo(client, id, 'channel'),
    ...(!found ? { msg: 'Cannot find channel handler' } : undefined),
  })
}
