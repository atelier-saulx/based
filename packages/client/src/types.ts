import { BasedSchemaField } from '@based/schema'
import { Command } from './protocol/types'

export type CommandResponseListeners = Map<
  number,
  [(val?: any) => void, (err: Error) => void]
>

export type SubscriptionHandlers = Map<
  number, // seqno
  number // channel id, is a 32 bit int (unsigned)
>

export type CommandQueueItem = { seqno: number; command: Command; payload: any }
export type CommandQueue = CommandQueueItem[]

export type IncomingMessageBuffers = Map<number, { ts: Number; bufs: Buffer[] }>

export enum SchemaUpdateMode {
  strict,
  flexible,
  migration,
}

export type SchemaMutations = (
  | {
      mutation: 'new_type'
      type: string
      new: BasedSchemaField
    }
  | {
      mutation: 'delete_type'
      type: string
    }
  | {
      mutation: 'change_field'
      type: string
      path: string[]
      old: BasedSchemaField
      new: BasedSchemaField
    }
  | {
      mutation: 'remove_field'
      type: string
      path: string[]
      old: BasedSchemaField
    }
)[]
