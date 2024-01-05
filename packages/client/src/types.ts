import {
  BasedSchemaField,
  BasedSchemaFieldPartial,
  BasedSchemaLanguage,
  BasedSchemaType,
  BasedSchemaTypePartial,
} from '@based/schema'
import { Command } from './protocol/types.js'

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

export type NewTypeSchemaMutation = {
  mutation: 'new_type'
  type: string
  new: BasedSchemaTypePartial
}

export type DeleteTypeSchemaMutation = {
  mutation: 'delete_type'
  type: string
}

export type ChangeTypeSchemaMutation = {
  mutation: 'change_type'
  type: string
  old: BasedSchemaType
  new: BasedSchemaTypePartial
}

export type NewFieldSchemaMutation = {
  mutation: 'new_field'
  type: string
  path: string[]
  new: BasedSchemaFieldPartial
}

export type ChangeFieldSchemaMutation = {
  mutation: 'change_field'
  type: string
  path: string[]
  old: BasedSchemaField
  new: BasedSchemaFieldPartial
}

export type RemoveFieldSchemaMutation = {
  mutation: 'remove_field'
  type: string
  path: string[]
  old: BasedSchemaField
}

export type ChangeLanguagesMutation = {
  mutation: 'change_languages'
  old: {
    language?: BasedSchemaLanguage
    translations?: BasedSchemaLanguage[]
    languageFallbacks?: Partial<
      Record<BasedSchemaLanguage, BasedSchemaLanguage[]>
    >
  }
  new: {
    language?: BasedSchemaLanguage
    translations?: BasedSchemaLanguage[]
    languageFallbacks?: Partial<
      Record<BasedSchemaLanguage, BasedSchemaLanguage[]>
    >
  }
}

export type SchemaTypeMutation =
  | NewTypeSchemaMutation
  | DeleteTypeSchemaMutation
  | ChangeTypeSchemaMutation

export type SchemaFieldMutation =
  | NewFieldSchemaMutation
  | ChangeFieldSchemaMutation
  | RemoveFieldSchemaMutation

export type SchemaMutation =
  | SchemaTypeMutation
  | SchemaFieldMutation
  | ChangeLanguagesMutation
