import { BasedClient } from '..'
import fflate from 'fflate'
import { getTargetInfo } from '../getTargetInfo'

export const debugChannelReqId = (
  client: BasedClient,
  id: number,
  type: 'register' | 'not-found' | 'publish',
  buffer?: Uint8Array,
  isDeflate?: boolean
) => {
  if (type === 'not-found') {
    client.emit('debug', {
      type: 'registerChannelId',
      direction: 'incoming',
      target: { id },
      msg: 'Cannot find channel',
    })
    return
  }
  const target = getTargetInfo(client, id, 'channel')
  if (type === 'register') {
    client.emit('debug', {
      type: 'registerChannelId',
      direction: 'outgoing',
      target,
    })
    return
  }

  if (!buffer) {
    return
  }

  let r: any
  let p: string
  const v = buffer.slice(12)
  if (isDeflate) {
    p = new TextDecoder().decode(fflate.inflateSync(v))
  } else {
    p = new TextDecoder().decode(v)
  }
  try {
    r = p ? JSON.parse(p) : undefined
  } catch (e) {
    r = p
  }

  client.emit('debug', {
    type: 'rePublishChannel',
    direction: 'outgoing',
    target,
    payload: r,
  })
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
    target: { id },
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
      target: getTargetInfo(client, id, 'sub'),
      msg: 'Cannot apply corrupt patch',
    })
    return
  }
  client.emit('debug', {
    type: 'subscriptionDiff',
    direction: 'incoming',
    checksum,
    payload,
    target: getTargetInfo(client, id, 'sub'),
  })
}

export const debugGet = (client: BasedClient, id: number) => {
  client.emit('debug', {
    type: 'get',
    direction: 'incoming',
    target: { id },
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
    target: getTargetInfo(client, id, 'sub'),
    ...(!found ? { msg: 'Cannot find subscription handler' } : undefined),
  })
}

export const debugAuth = (client: BasedClient, payload: any) => {
  client.emit('debug', {
    type: 'auth',
    direction: 'incoming',
    payload,
    target: {},
  })
}

export const debugError = (client: BasedClient, payload: any) => {
  client.emit('debug', {
    type: 'error',
    direction: 'incoming',
    payload,
    target: {},
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
    target: getTargetInfo(client, id, 'channel'),
    ...(!found ? { msg: 'Cannot find channel handler' } : undefined),
  })
}
