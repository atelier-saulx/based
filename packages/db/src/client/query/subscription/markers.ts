// --------------------------------------------
// TODO hooks for update / create
import { PropDef, PropDefEdge } from '../../../server/schema/types.js'
import { BasedDb } from '../../../index.js'
import { SubscriptionMarkers } from './types.js'

export const getSubscriptionMarkers: SubscriptionMarkers = (
  db: BasedDb,
  typeId: number,
  id: number,
  isCreate: boolean,
) => {
  const t = db.modifySubscriptions.get(typeId)
}

export const checkSubscriptionMarkers = (
  db: BasedDb,
  markers: SubscriptionMarkers,
  prop: PropDef | PropDefEdge, // number
) => {
  console.log(prop, markers)
  // will check filters
}
