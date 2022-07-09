import { GenericObject } from './generic'
// -------- schema ---------
export type BasedDbSchema = {
  db: Set<string>
  schema: { [db: string]: GenericObject }
}

export type Schema = {
  // will add payload type & response type
  observables: { [name: string]: { type: number } }
  // will add payload type & response type
  functions: { [name: string]: { type: number } }
  schema: BasedDbSchema
}

export type closeSchemaObserve = () => void
