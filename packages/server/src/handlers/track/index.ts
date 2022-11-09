import { BasedServer } from '../..'
import Client from '../../Client'
import { TrackMessage, TrackOpts } from '@based/client'

const incr = (server: BasedServer, key: string, iso: string, n: number = 1) => {
  server.db.redis.hincrby({ name: 'analytics' }, key, iso, n)
}

const addToChanged = (server: BasedServer, key: string) => {
  server.db.redis.sadd({ name: 'analytics' }, 'CHANGED', key)
}

/*
  A = active
  T = timeline
  U = unique
  (no prefix) = aggregate vists
  TS = type
  S = current server

  iso is also total, max for active
*/

export const deleteEvent = async (server: BasedServer, key: string) => {
  const valuesPerIso = await server.db.redis.hgetall({ name: 'analytics' }, key)
  const q = []
  q.push(
    server.db.redis.del({ name: 'analytics' }, key),
    server.db.redis.del({ name: 'analytics' }, 'U_' + key),
    server.db.redis.del({ name: 'analytics' }, 'A_' + key)
  )
  for (const iso in valuesPerIso) {
    if (iso === 'max') {
      q.push(
        server.db.redis.del(
          { name: 'analytics' },
          'T_' + 'A_' + key + '_' + iso
        )
      )
    } else {
      q.push(
        server.db.redis.del({ name: 'analytics' }, 'T_' + key + '_' + iso),
        server.db.redis.del(
          { name: 'analytics' },
          'T_' + 'U_' + key + '_' + iso
        ),
        server.db.redis.del(
          { name: 'analytics' },
          'T_' + 'A_' + key + '_' + iso
        )
      )
    }
  }

  const splitK = key.split('_')
  if (splitK.length > 0) {
    q.push(
      server.db.redis.srem(
        { name: 'analytics' },
        'TS_' + splitK[0],
        splitK.slice(1).join('_')
      )
    )
  }
  q.push(server.db.redis.srem({ name: 'analytics' }, 'TYPES', splitK[0]))
  addToChanged(server, key)
  addToChanged(server, 'U_' + key)
  addToChanged(server, 'A_' + key)
  await Promise.all(q)
}

export const trackEvent = async (
  server: BasedServer,
  type: string,
  opts: TrackOpts,
  iso: string
) => {
  const amount = opts?.amount || 1
  incr(server, type, iso, amount)
  incr(server, type, 'total', amount)
  addToChanged(server, type)
  // Add types
  const splitK = type.split('_')
  if (splitK.length > 0) {
    server.db.redis.sadd(
      { name: 'analytics' },
      'TS_' + splitK[0],
      splitK.slice(1).join('_')
    )
  }
  server.db.redis.sadd({ name: 'analytics' }, 'TYPES', splitK[0])
}

export default async (
  server: BasedServer,
  client: Client,
  [, payload]: TrackMessage
) => {
  const {
    t: type,
    u: isUnique,
    s: stopTracking,
    e: isEvent,
    o: opts,
    r: isRemove,
  } = payload
  if (isRemove) {
    return deleteEvent(server, type)
  } else {
    const iso = client.geo.iso
    // iso time
    if (stopTracking) {
      if (client.track?.has(type)) {
        client.track.delete(type)
        const activeKey = `A_${type}`
        incr(server, activeKey, iso, -1)
        incr(server, activeKey, 'total', -1)
        incr(server, `S_${process.env.SERVICE_ID}`, `${type}_${iso}`, -1)
        addToChanged(server, activeKey)
      }
    } else {
      if (isUnique) {
        const uniqueKey = `U_${type}`
        incr(server, uniqueKey, iso)
        incr(server, uniqueKey, 'total')
        addToChanged(server, uniqueKey)
      }
      trackEvent(server, type, opts, iso)
      if (!isEvent) {
        if (!client.track) {
          client.track = new Set()
          client.trackIso = iso
        }
        if (client.track.has(type)) {
          // allrdy tracking!
        } else {
          client.track.add(type)
          const activeKey = `A_${type}`
          incr(server, activeKey, iso)
          incr(server, activeKey, 'total')
          incr(server, `S_${process.env.SERVICE_ID}`, `${type}_${iso}`)
          addToChanged(server, activeKey)
        }
      }
    }
  }
}
