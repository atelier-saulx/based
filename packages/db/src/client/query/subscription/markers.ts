// --------------------------------------------
// TODO hooks for update / create
import { PropDef, PropDefEdge } from '../../../server/schema/types.js'
import { BasedDb } from '../../../index.js'
import {
  Subscription,
  SubscriptionMarkerMap,
  SubscriptionMarkersCheck,
} from './types.js'
import { BasedDbQuery } from '../BasedDbQuery.js'
import { startSubscription } from './run.js'

export const getSubscriptionMarkers = (
  db: BasedDb,
  typeId: number,
  id: number,
  isCreate: boolean,
): SubscriptionMarkersCheck | false => {
  if (!(typeId in db.subscriptionMarkers)) {
    return false
  }
  const t = db.subscriptionMarkers[typeId]

  if (!isCreate) {
    if (t.ids.has(id)) {
      const idMarkers = t.ids.get(id)
      return { ids: idMarkers, collection: false }
    }
  }

  return false
}

export const checkSubscriptionMarkers = (
  db: BasedDb,
  m: SubscriptionMarkersCheck,
  prop: PropDef | PropDefEdge, // number
) => {
  let newSub = false

  if (m.ids) {
    const markers = m.ids

    if (prop.separate) {
      const propSubs = markers.props[prop.prop]
      if (propSubs) {
        for (const s of propSubs) {
          if (!s.inProgress) {
            newSub = true
            db.subscriptionsToRun.push(s)
          }
        }
      }
    } else {
      const propSubs = markers.main[prop.start]
      if (propSubs) {
        if (propSubs) {
          for (const s of propSubs) {
            if (!s.inProgress) {
              newSub = true
              db.subscriptionsToRun.push(s)
            }
          }
        }
      }
    }

    if (newSub && !db.subscriptionsInProgress) {
      startSubscription(db)
    }
  }
}

export const removeSubscriptionMarkers = (q: BasedDbQuery) => {
  // derp
}

export const createSubscriptionMarkerMap = (): SubscriptionMarkerMap => {
  return {}
}

// resetting subs is a copy for now
export const addSubscriptionMarkers = (
  q: BasedDbQuery,
  subscription: Subscription,
) => {
  const typeId = q.def.schema.id

  if (!q.db.subscriptionMarkers[typeId]) {
    q.db.subscriptionMarkers[typeId] = {
      ids: new Map(),
      collection: {
        main: {},
        props: {},
      },
    }
  }

  const modifySubscriptionsType = q.db.subscriptionMarkers[typeId]

  if ('id' in q.def.target) {
    const id = q.def.target.id as number

    if (!modifySubscriptionsType.ids.has(id)) {
      modifySubscriptionsType.ids.set(id, {
        main: {},
        props: {},
      })
    }

    const idMarker = modifySubscriptionsType.ids.get(id)

    // include
    const props = q.def.include.props
    const main = q.def.include.main

    for (const p of props) {
      if (!(p in idMarker.props)) {
        idMarker.props[p] = []
      }
      const markerProps = idMarker.props[p]
      markerProps.push(subscription)
    }

    for (const p in main.include) {
      if (!(p in idMarker.main)) {
        idMarker.main[p] = []
      }
      const markerProps = idMarker.main[p]
      markerProps.push(subscription)
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
  //   db.subscriptionMarkers.forEach((t) => {})
}
