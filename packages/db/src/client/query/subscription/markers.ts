// --------------------------------------------
// TODO hooks for update / create
import { PropDef, PropDefEdge } from '../../../server/schema/types.js'
import { SubscriptionMarkers } from './types.js'
import { DbClient } from '../../index.js'

export const getSubscriptionMarkers: SubscriptionMarkers = (
  db: DbClient,
  typeId: number,
  id: number,
  isCreate: boolean,
) => {
  const t = db.modifySubscriptions.get(typeId)
}

export const checkSubscriptionMarkers = (
  db: DbClient,
  markers: SubscriptionMarkers,
  prop: PropDef | PropDefEdge, // number
) => {
  console.log(prop, markers)
  // will check filters
}
