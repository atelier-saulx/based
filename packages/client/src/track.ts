import { BasedClient, TrackOpts, TrackPayload } from '.'
import { addToQueue } from './queue'
import { RequestTypes } from '@based/types'
import { hashCompact } from '@saulx/hash'

const notUnique: Set<string> = new Set()

const isUnique = (x: string): boolean => {
  if (typeof window !== 'undefined') {
    if (notUnique.has(x)) {
      return false
    }
    notUnique.add(x)
    try {
      const name = '_ba:' + hashCompact(x)
      if (localStorage.getItem(name)) {
        return false
      }
      localStorage.setItem(name, '1')
      return true
    } catch (err) {
      return false
    }
  }
  return false
}

export const genKey = (
  type: string,
  params?: { [key: string]: number | string | boolean }
): string => {
  if (params) {
    let str = `${type}`
    const keys = Object.keys(params).sort()
    for (const k of keys) {
      str += '_' + k + '_' + params[k]
    }
    return str
  } else {
    return type
  }
}

export default (
  client: BasedClient,
  type: string,
  params?: { [key: string]: number | string | boolean },
  untrack?: boolean,
  event?: boolean,
  opts?: TrackOpts,
  del?: boolean
) => {
  const k = genKey(type, params)
  const payload: TrackPayload = { t: k }
  if (del) {
    payload.r = 1
  }
  if (event) {
    payload.e = 1
    if (opts) {
      payload.o = opts
    }
  }
  if (untrack) {
    payload.s = 1
    client.tracking.delete(k)
  } else if (!del) {
    if (!event) {
      if (!client.tracking) {
        client.tracking = new Set()
      }
      client.tracking.add(k)
    }

    if (isUnique(k)) {
      payload.u = 1
    }
  }
  addToQueue(client, [RequestTypes.Track, payload])
}
