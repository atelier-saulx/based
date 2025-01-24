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
import { QueryDef } from '../types.js'

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

  let subMarkersCheck: SubscriptionMarkersCheck | false = false

  if (!isCreate) {
    if (t.ids.has(id)) {
      const idMarkers = t.ids.get(id)
      subMarkersCheck = { ids: idMarkers, collection: false }
    }
  }

  if (t.collection) {
    if (!subMarkersCheck) {
      subMarkersCheck = { ids: false, collection: t.collection }
    } else {
      subMarkersCheck.collection = t.collection
    }
  }

  return subMarkersCheck
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
  }

  if (m.collection) {
    const markers = m.collection
    if (prop.separate) {
      const propSubs = markers.props[prop.prop]
      // @ts-ignore
      if (propSubs && !propSubs.__handled) {
        // @ts-ignore
        propSubs.__handled = true
        for (const s of propSubs) {
          if (!s.inProgress) {
            newSub = true
            db.subscriptionsToRun.push(s)
          }
        }
      }
    } else {
      const propSubs = markers.main[prop.start]
      // @ts-ignore
      if (propSubs && !propSubs.__handled) {
        // @ts-ignore
        propSubs.__handled = true
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

export const createSubscriptionMarkerMap = (): SubscriptionMarkerMap => {
  return {}
}

const getFilterFields = (
  filter: QueryDef['filter'],
  results: { main: Set<number>; props: Set<number> } = {
    main: new Set(),
    props: new Set(),
  },
) => {
  const conditions = filter.conditions
  if (conditions) {
    conditions.forEach((v, k) => {
      if (k === 0) {
        for (const buf of v) {
          results.main.add(buf.readUint16LE(4))
        }
      } else {
        results.props.add(k)
      }
    })
  }
  if (filter.or) {
    getFilterFields(filter.or, results)
  }
  return results
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
  const markerType = q.db.subscriptionMarkers[typeId]
  if ('id' in q.def.target) {
    const id = q.def.target.id as number
    if (!markerType.ids.has(id)) {
      markerType.ids.set(id, {
        main: {},
        props: {},
      })
    }
    const marker = markerType.ids.get(id)
    const props = q.def.include.props
    const main = q.def.include.main
    for (const p of props) {
      if (!(p in marker.props)) {
        marker.props[p] = []
      }
      const markerProps = marker.props[p]
      markerProps.push(subscription)
    }
    for (const p in main.include) {
      if (!(p in marker.main)) {
        marker.main[p] = []
      }
      const markerProps = marker.main[p]
      markerProps.push(subscription)
    }
  } else if ('alias' in q.def.target) {
    // later
  } else {
    const props = q.def.include.props
    const main = q.def.include.main
    const marker = markerType.collection
    for (const p of props) {
      if (!(p in marker.props)) {
        marker.props[p] = []
      }
      marker.props[p].push(subscription)
    }
    for (const p in main.include) {
      if (!(p in marker.main)) {
        marker.main[p] = []
      }
      marker.main[p].push(subscription)
    }
    if (q.def.filter) {
      const r = getFilterFields(q.def.filter)
      r.main.forEach((k) => {
        const p = String(k)
        if (!(p in marker.main)) {
          marker.main[p] = []
          // @ts-ignore
          marker.main[p].__handled = false
        }
        if (!main.include[p]) {
          marker.main[p].push(subscription)
        }
      })
      r.props.forEach((k) => {
        const p = String(k)
        if (!(p in marker.props)) {
          marker.props[p] = []
          // @ts-ignore
          marker.props[p].__handled = false
        }
        if (!props.has(k)) {
          marker.props[p].push(subscription)
        }
      })
    }
  }
}

export const resetSubscriptionMarkers = (db: BasedDb) => {
  for (const typeId in db.subscriptionMarkers) {
    const t = db.subscriptionMarkers[typeId]

    for (const k in t.collection.main) {
      // @ts-ignore
      t.collection.main[k].__handled = false
    }
    for (const k in t.collection.props) {
      // @ts-ignore
      t.collection.props[k].__handled = false
    }
  }
}

export const removeSubscriptionMarkers = (q: BasedDbQuery) => {
  // derp
  console.log('remove markers!')
}
