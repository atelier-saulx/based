import { ParseError } from '../set/error'
import {
  BasedSchemaType,
  BasedSchemaFields,
  BasedSchemaField,
  BasedSchema,
} from '../types'
import { ArgsClass } from './args'

export type Path = (string | number)[]

export type ErrorHandler<T> = (args: ArgsClass<T>, code: ParseError) => void

export type Collect<T> = (args: ArgsClass<T>, value: any) => any

export type FieldParser<K extends keyof BasedSchemaFields, T = any> = (
  args: ArgsClass<T, K>
) => Promise<ArgsClass<T> | ArgsOpts<T> | void>

export type KeyParser<T = any> = (
  args: ArgsClass<T, keyof BasedSchemaFields>
) => Promise<ArgsOpts<T> | ArgsClass<T> | void>

export type FieldParsers<T = any> = {
  [Key in keyof BasedSchemaFields]: FieldParser<Key, T>
}

export type Opts<T> = {
  init: (
    value: any,
    schema: BasedSchema,
    error: (err: ParseError) => void
  ) => Promise<ArgsOpts<T>>
  parsers: {
    fields: Partial<{
      [Key in keyof BasedSchemaFields]: FieldParser<Key, T>
    }>
    keys: { [key: string]: KeyParser<T> } // $list -> true
    any?: KeyParser<T> // y.x
    catch?: KeyParser<T> //
  }
  collect?: (args: ArgsClass<T>, value: any) => any
  backtrack?: (
    args: ArgsClass<T>,
    fromBackTrack: any[],
    collectedCommands: any[]
  ) => any
  requiresAsyncValidation?: (validationType: any) => Promise<boolean>
  errorsCollector?: ErrorHandler<T>
}

export enum Stopped {
  onlyStopFieldParser,
  stopAll,
}

export type ArgsOpts<
  T,
  K extends keyof BasedSchemaFields = keyof BasedSchemaFields
> = {
  target?: T
  key?: string | number
  path?: Path
  value?: any
  prev?: ArgsClass<T, K>
  fieldSchema?: BasedSchemaField
  typeSchema?: BasedSchemaType
  skipCollection?: boolean
  collect?: (args: ArgsClass<T, K>, value?: any) => any
}
