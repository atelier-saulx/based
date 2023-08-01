import { BasedSchema } from '../types'
import { BasedSchemaType, BasedSchemaFields } from '../types'
import { ArgsOpts, Path, Opts, Stopped, ErrorHandler, Collect } from './types'
import { parse } from './parse'

export class ArgsClass<
  T,
  K extends keyof BasedSchemaFields = keyof BasedSchemaFields
> {
  prev: ArgsClass<T, K>

  root: ArgsClass<T, K> // getter

  // only on root
  _opts: Opts<T>

  _target: T

  _schema: BasedSchema

  _collectOverride: Collect<T>

  fieldSchema?: BasedSchemaFields[K]

  typeSchema?: BasedSchemaType

  path: Path

  skipCollection: boolean

  value: any

  stopped: Stopped | void

  fromBackTrack: any[]

  collectedCommands: any[]

  constructor(opts: ArgsOpts<T, K>, prev?: ArgsClass<T, K>) {
    this.fromBackTrack = []
    this.collectedCommands = []
    if (opts.prev) {
      prev = opts.prev
    }
    if (prev) {
      this.prev = prev
      this.root = prev.root
    }
    if (opts.path) {
      this.path = opts.path
    } else if (prev && opts.key) {
      this.path = [...prev.path, opts.key]
    } else {
      this.path = []
    }
    this.value = opts.value
    if (opts.fieldSchema) {
      // @ts-ignore
      this.fieldSchema = opts.fieldSchema
    }
    if (opts.typeSchema) {
      this.typeSchema = opts.typeSchema
    }
    if (opts.target) {
      this._target = opts.target
    }
    if (opts.collect) {
      this._collectOverride = opts.collect
    }
    if (opts.skipCollection) {
      this.skipCollection = opts.skipCollection
    }
  }

  get schema(): BasedSchema {
    if (this._schema) {
      return this.schema
    }
    return this.root._schema
  }

  get key(): (number | string) | void {
    return this.path[this.path.length - 1]
  }

  get target(): T {
    if (this._target) {
      return this._target
    }
    let p = this.prev
    while (p) {
      if (p._target) {
        return p._target
      }
      p = p.prev
    }
  }

  stop(onllyStopFieldSchemaParser?: boolean) {
    if (onllyStopFieldSchemaParser) {
      this.stopped = Stopped.onlyStopFieldParser
    } else {
      this.stopped = Stopped.stopAll
    }
  }

  async parse(opts?: ArgsOpts<T>): Promise<ArgsClass<T> | void> {
    if (!opts) {
      return parse(this)
    } else {
      const newArgs = new ArgsClass(opts, this)
      if (this._collectOverride)
        [(newArgs._collectOverride = this._collectOverride)]
      return newArgs.parse()
    }
  }

  collect(value?: any) {
    if (this.skipCollection) {
      return
    }
    if (this._collectOverride) {
      this.collectedCommands.push(
        this._collectOverride(this, value ?? this.value)
      )
    } else if (this.root._opts.collect) {
      this.collectedCommands.push(
        this.root._opts.collect(this, value ?? this.value)
      )
    }
  }

  error(ParseError): void {
    this.root._opts.errorsCollector(this, ParseError)
  }
}
