// --------------------------------------------
// TODO hooks for update / create
import { PropDef, PropDefEdge } from '../../../server/schema/types.js'
import { BasedDb } from '../../../index.js'
import { SubscriptionMarkers } from './types.js'
import { BasedDbQuery } from '../BasedDbQuery.js'

export const getSubscriptionMarkers = (
  db: BasedDb,
  typeId: number,
  id: number,
  isCreate: boolean,
): SubscriptionMarkers | false => {
  const t = db.modifySubscriptions.get(typeId)

  return false
}

export const checkSubscriptionMarkers = (
  db: BasedDb,
  markers: SubscriptionMarkers,
  prop: PropDef | PropDefEdge, // number
) => {
  console.log(prop, markers)
  // will check filters
}

export const removeSubscriptionMarkers = (q: BasedDbQuery) => {
  // derp
}

export const addSubscriptionMarkers = (q: BasedDbQuery) => {
  const typeId = q.def.schema.id

  if (!q.db.modifySubscriptions.has(typeId)) {
    // if is id
    // q.db.modifySubscriptions.set(typeId, {
    //   toCheck: 0,
    //   total: 0,
    //   ids: {
    //     subs: new Map(),
    //   },
    //   filters: {
    //     subs: [],
    //   },
    // })
    // //-----------
  }

  const modifySubscriptionsType = q.db.modifySubscriptions.get(typeId)

  if ('id' in q.def.target) {
  } else if ('alias' in q.def.target) {
    // later
  } else {
    // FILTERS
    // add specific stuff
  }
}
