import { ParseError } from '../error'
import {
  BasedSchemaType,
  BasedSchemaFields,
  BasedSchemaField,
  BasedSchema,
} from '../types.js'
import { ArgsClass } from './args'

export type Path = (string | number)[]

export type ErrorHandler<T> = (
  code: ParseError,
  args: ArgsClass<T> | ArgsOpts<T>
) => void

export type Collect<T> = (args: ArgsClass<T>) => any

export type FieldParser<K extends keyof BasedSchemaFields, T = any> = (
  args: ArgsClass<T, K>
) => Promise<ArgsClass<T> | ArgsOpts<T> | void>

export type KeyParser<T = any> = (
  args: ArgsClass<T, keyof BasedSchemaFields>
) => Promise<ArgsOpts<T> | ArgsClass<T> | void>

export type FieldParsers<T = any> = {
  [Key in keyof BasedSchemaFields]: FieldParser<Key, T>
}

export type AsyncOperation<T> = (
  args: ArgsClass<T>,
  type?: string
) => Promise<any>

export type Opts<T> = {
  init: (
    value: any,
    schema: BasedSchema,
    error: ErrorHandler<T>
  ) => Promise<ArgsOpts<T>>
  parsers: {
    fields: Partial<{
      [Key in keyof BasedSchemaFields]: FieldParser<Key, T>
    }>
    keys: { [key: string]: KeyParser<T> }
    any?: KeyParser<T>
    catch?: KeyParser<T>
  }
  collect?: (args: ArgsClass<T>) => any
  error?: ErrorHandler<T>
  backtrack?: (
    args: ArgsClass<T>,
    fromBackTrack: any[],
    collectedCommands: any[]
  ) => any
  asyncOperationHandler?: AsyncOperation<T>
}

export enum Stopped {
  onlyStopFieldParser,
  stopAll,
}

export type ArgsOpts<
  T,
  K extends keyof BasedSchemaFields = keyof BasedSchemaFields
> = {
  parseTopLevel?: boolean
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

// Add asyncOperations // requiresAsyncValidation -> asyncOperation: () => {}
