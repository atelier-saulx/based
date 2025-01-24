// --------------------------------------------
// TODO hooks for update / create
import { PropDef, PropDefEdge } from '../../../server/schema/types.js'
import { BasedDb } from '../../../index.js'
import { Subscription, SubscriptionMarkers } from './types.js'
import { BasedDbQuery } from '../BasedDbQuery.js'
import { startSubscription } from './run.js'

export const getSubscriptionMarkers = (
  db: BasedDb,
  typeId: number,
  id: number,
  isCreate: boolean,
): SubscriptionMarkers | false => {
  const t = db.subscriptionMarkers.get(typeId)
  if (!t) {
    return false
  }

  if (!isCreate) {
    const idMarkers = t.ids.get(id)
    if (idMarkers) {
      return idMarkers
    }
  }

  return false
}

export const checkSubscriptionMarkers = (
  db: BasedDb,
  markers: SubscriptionMarkers,
  prop: PropDef | PropDefEdge, // number
) => {
  if (prop.separate) {
    const propSubs = markers.props.get(prop.prop)
    if (propSubs) {
      propSubs.forEach((s) => {
        db.subscriptionsToRun.push(s)
        // propSubs.delete(s)
      })

      //   if (!propSubs.size) {
      //     markers.props.delete(prop.prop)
      //     if (markers.props.size === 0 && markers.main.size === 0) {
      //       // db remove
      //     }
      //   }

      if (!db.subscriptionsInProgress) {
        startSubscription(db)
      }
    }
  } else {
    const propSubs = markers.main.get(prop.start)
    if (propSubs) {
      propSubs.forEach((s) => {
        db.subscriptionsToRun.push(s)
        // propSubs.delete(s)
      })

      //   if (!propSubs.size) {
      //     markers.props.delete(prop.prop)
      //     if (markers.props.size === 0 && markers.main.size === 0) {
      //       // db remove
      //     }
      //   }

      if (!db.subscriptionsInProgress) {
        startSubscription(db)
      }
    }
  }
  // will check filters
}

export const removeSubscriptionMarkers = (q: BasedDbQuery) => {
  // derp
}

// resetting subs is a copy for now
export const addSubscriptionMarkers = (
  q: BasedDbQuery,
  subscription: Subscription,
) => {
  const typeId = q.def.schema.id

  if (!q.db.subscriptionMarkers.has(typeId)) {
    q.db.subscriptionMarkers.set(typeId, {
      ids: new Map(),
      filters: new Map(),
    })
  }

  const modifySubscriptionsType = q.db.subscriptionMarkers.get(typeId)

  if ('id' in q.def.target) {
    const id = q.def.target.id as number

    if (!modifySubscriptionsType.ids.has(id)) {
      modifySubscriptionsType.ids.set(id, {
        main: new Map(),
        props: new Map(),
      })
    }

    const idMarker = modifySubscriptionsType.ids.get(id)

    // include
    const props = q.def.include.props
    const main = q.def.include.main

    for (const p of props) {
      if (!idMarker.props.has(p)) {
        idMarker.props.set(p, new Set())
      }
      const markerProps = idMarker.props.get(p)
      markerProps.add(subscription)
    }

    for (const key in main.include) {
      const p = Number(key)
      if (!idMarker.main.has(p)) {
        idMarker.main.set(p, new Set())
      }
      const markerProps = idMarker.main.get(p)
      markerProps.add(subscription)
    }

    // references later
    // needs ot do stuff with specific values if they are there...
  } else if ('alias' in q.def.target) {
    // later
  } else {
    // FILTERS
    // add specific stuff
    // filter
  }
}

export const resetSubscriptionMarkers = (db: BasedDb) => {
  db.subscriptionMarkers.forEach((t) => {})
}
