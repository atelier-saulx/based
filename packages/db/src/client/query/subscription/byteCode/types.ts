import { QueryType } from '../../types.js'

export type SubscriptionId = {
  type: number
  ids: Set<number>
  includeFields: Set<number> // start with set
  subId: number
  references: SubscriptionMulti
  // filter
}

export type SubscriptionMulti = {
  type: number
  includeFields: Set<number> // start with set
  subId: number
  references: SubscriptionMulti
  // filter
}

// maybe just create DEF
