import { BasedSchema } from '../types.js'
import { BasedSchemaType, BasedSchemaFields } from '../types.js'
import { ArgsOpts, Path, Opts, Stopped, Collect } from './types'
import { parse } from './parse'
import { ParseError } from '../error'
import { deepEqual } from '@saulx/utils'

let id = 0

export class ArgsClass<
  T,
  K extends keyof BasedSchemaFields = keyof BasedSchemaFields
> {
  errors: any[]

  id: number

  prev: ArgsClass<T, K>

  root: ArgsClass<T, K> // getter

  // only on root
  _opts: Opts<T>

  _target: T

  _stopObject?: boolean

  _schema: BasedSchema

  parseTopLevel?: boolean

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
    this.id = ++id
    this.fromBackTrack = []
    this.collectedCommands = []
    if (opts.prev) {
      prev = opts.prev
    }
    if (opts.parseTopLevel) {
      this.parseTopLevel = opts.parseTopLevel
    }
    if (prev) {
      this.prev = prev
      this.root = prev.root
      this.fieldSchema = prev.fieldSchema
    }
    if (opts.path) {
      this.path = opts.path
    } else if (prev && opts.key !== undefined) {
      this.path = [...prev.path, opts.key]
    } else if (opts && prev) {
      this.path = prev.path
    } else {
      this.path = []
    }
    this.value = opts.value
    if (opts.fieldSchema) {
      // @ts-ignore K is too loose
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
    } else if (prev?._collectOverride) {
      this._collectOverride = prev._collectOverride
    }

    if (opts.skipCollection) {
      this.skipCollection = opts.skipCollection
    } else if (prev?.skipCollection) {
      this.skipCollection = true
    }
  }

  get schema(): BasedSchema {
    if (this._schema) {
      return this.schema
    }
    return this.root._schema
  }

  get key(): number | string {
    return this.path[this.path.length - 1] ?? ''
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
    const target = this
    if (onllyStopFieldSchemaParser) {
      target.stopped = Stopped.onlyStopFieldParser
    } else {
      target.stopped = Stopped.stopAll
    }
  }

  create(opts?: ArgsOpts<T>): ArgsClass<T> {
    const newArgs = new ArgsClass(opts, this)
    if (this._collectOverride && !opts.collect) {
      newArgs._collectOverride = this._collectOverride
    }
    if (this.skipCollection && opts.skipCollection !== false) {
      newArgs.skipCollection = this.skipCollection
    }
    if (!('value' in opts)) {
      newArgs.value = this.value
    }
    return newArgs
  }

  async parse(opts?: ArgsOpts<T>): Promise<ArgsClass<T> | void> {
    if (!opts) {
      return parse(this)
    } else {
      const newArgs = new ArgsClass(opts, this)

      if (newArgs.value === undefined) {
        newArgs.value = this.value
      }

      return newArgs.parse()
    }
  }

  getTopPaths(): Path[] {
    let argPath = []
    let p = this
    while (p) {
      argPath.unshift({ path: p.path, id: p.id })
      // @ts-ignore
      p = p.prev
    }
    return argPath
  }

  getBackTrackTarget(): ArgsClass<T> {
    let p: ArgsClass<T> = this
    while (p) {
      if (p.prev) {
        if (deepEqual(p.prev.path, p.path)) {
          p = p.prev
        } else {
          p = p.prev
          break
        }
      } else {
        break
      }
    }
    return p
  }

  getCollectTarget() {}

  collect(value?: any) {
    if (this.skipCollection) {
      return
    }
    const collectArgs =
      value !== undefined ? new ArgsClass({ value }, this) : this

    let collectTarget = this.prev

    if (this._collectOverride) {
      collectTarget.collectedCommands.push(this._collectOverride(collectArgs))
    } else {
      collectTarget.collectedCommands.push(this.root._opts.collect(collectArgs))
    }
  }

  error(code: ParseError): void {
    this.root._opts.error(code, this)
  }
}
