import {
  QueryDef,
  createQueryDef,
  QueryDefType,
  QueryTarget,
  filter,
  Operator,
  sort,
  defToBuffer,
  filterOr,
  QueryByAliasObj,
  isAlias,
  includeField,
  includeFields,
  addAggregate,
  groupBy,
} from './query.js'
import { BasedQueryResponse } from './BasedIterable.js'
import {
  createOrGetEdgeRefQueryDef,
  createOrGetRefQueryDef,
} from './include/utils.js'
import { FilterBranch } from './filter/FilterBranch.js'
import { search, Search, vectorSearch } from './search/index.js'
import native from '../../native.js'
import { REFERENCE, REFERENCES } from '@based/schema/def'
import { subscribe, OnData, OnError, OnClose } from './subscription/index.js'
import { registerQuery } from './registerQuery.js'
import { DbClient } from '../index.js'
import { langCodesMap, LangName } from '@based/schema'
import { FilterAst, FilterBranchFn, FilterOpts } from './filter/types.js'
import { convertFilter } from './filter/convertFilter.js'
import { validateLocale, validateRange } from './validation.js'
import { DEF_RANGE_PROP_LIMIT } from './thresholds.js'
import { concatUint8Arr, wait } from '@saulx/utils'
import { AggregateType } from './aggregates/types.js'
import { displayTarget } from './display.js'
import picocolors from 'picocolors'

export { QueryByAliasObj }

export type SelectFn = (field: string) => BasedDbReferenceQuery

export type BranchInclude = (select: SelectFn) => any

export type QueryCommand = {
  method: string
  args: any[]
}

export class QueryBranch<T> {
  db: DbClient
  def: QueryDef
  queryCommands: QueryCommand[]

  constructor(db: DbClient, def?: QueryDef) {
    this.db = db
    this.def = def
  }

  sort(field: string, order: 'asc' | 'desc' = 'asc'): T {
    if (this.queryCommands) {
      this.queryCommands.push({
        method: 'sort',
        args: [field, order],
      })
    } else {
      sort(this.def, field, order)
    }
    // @ts-ignore
    return this
  }

  filter<O extends Operator>(
    field: string,
    operator?: O | boolean,
    value?: any,
    opts?: FilterOpts<O>,
  ): T {
    if (this.queryCommands) {
      this.queryCommands.push({
        method: 'filter',
        args: [field, operator, value, opts],
      })
    } else {
      const f = convertFilter(this.def, field, operator, value, opts)
      if (!f) {
        // @ts-ignore
        return this
      }
      filter(this.db, this.def, f, this.def.filter)
    }
    // @ts-ignore
    return this
  }

  filterBatch(f: FilterAst) {
    if (this.queryCommands) {
      this.queryCommands.push({
        method: 'filterBatch',
        args: [f],
      })
    } else {
      filter(this.db, this.def, f, this.def.filter)
    }
    // @ts-ignore
    return this
  }

  search(query: string, ...fields: Search[]): T

  search(
    query: ArrayBufferView,
    field: string,
    opts?: Omit<FilterOpts, 'lowerCase'>,
  ): T

  search(
    query: string | ArrayBufferView,
    field?: Search | string,
    opts?: Omit<FilterOpts, 'lowerCase'> | Search,
    ...fields: Search[]
  ): T {
    if (this.queryCommands) {
      this.queryCommands.push({
        method: 'search',
        args: [query, field, opts, ...fields],
      })
    } else {
      if (ArrayBuffer.isView(query)) {
        // @ts-ignore
        vectorSearch(this.def, query, field, opts ?? {})
        // @ts-ignore
        return this
      }

      if (field) {
        if (!fields) {
          // @ts-ignore
          fields = [field]
        } else {
          // @ts-ignore
          fields.unshift(field)
        }
      }

      if (opts) {
        if (!fields) {
          // @ts-ignore
          fields = [opts]
        } else {
          // @ts-ignore
          fields.unshift(opts)
        }
      }

      if (fields.length) {
        if (fields.length === 1) {
          search(this.def, query, fields[0])
        } else {
          const s = {}
          for (const f of fields) {
            if (typeof f === 'string') {
              s[f] = 0
            } else if (Array.isArray(f)) {
              for (const ff of f) {
                s[ff] = 0
              }
            } else if (typeof f === 'object') {
              Object.assign(s, f)
            }
          }
          search(this.def, query, s)
        }
      } else {
        search(this.def, query)
      }
    }
    // @ts-ignore
    return this
  }

  groupBy(field: string): T {
    if (this.queryCommands) {
      this.queryCommands.push({
        method: 'groupBy',
        args: [field],
      })
    } else {
      groupBy(this.def, field)
    }
    // only works with aggregates for now
    // @ts-ignore
    return this
  }

  count(field: string = '$count'): T {
    if (this.queryCommands) {
      this.queryCommands.push({
        method: 'count',
        args: [field],
      })
    } else {
      const p = field.split('.')
      addAggregate(AggregateType.COUNT, this.def, p)
    }
    // @ts-ignore
    return this
  }

  sum(...fields: (string | string[])[]): T {
    if (fields.length === 0) {
      throw new Error('Empty sum() called')
    }

    if (this.queryCommands) {
      this.queryCommands.push({
        method: 'sum',
        args: fields,
      })
    } else {
      addAggregate(AggregateType.SUM, this.def, fields)
    }
    // @ts-ignore
    return this
  }

  or(fn: FilterBranchFn): T
  or(
    field: string,
    operator?: Operator | boolean,
    value?: any,
    opts?: FilterOpts,
  ): T
  or(
    field: string | FilterBranchFn,
    operator?: Operator | boolean,
    value?: any,
    opts?: FilterOpts,
  ): T {
    if (this.queryCommands) {
      this.queryCommands.push({
        method: 'or',
        args: [field, operator, value, opts],
      })
    } else {
      if (typeof field === 'function') {
        const f = new FilterBranch(
          this.db,
          filterOr(this.db, this.def, [], this.def.filter),
          this.def,
        )
        field(f)
        this.def.filter.size += f.filterBranch.size
      } else {
        const f = convertFilter(this.def, field, operator, value, opts)
        if (f) {
          filterOr(this.db, this.def, f, this.def.filter)
        }
      }
    }
    // @ts-ignore
    return this
  }

  range(start: number, end: number = DEF_RANGE_PROP_LIMIT): T {
    if (this.queryCommands) {
      this.queryCommands.push({ method: 'range', args: [start, end] })
    } else {
      const offset = start
      const limit = end - start
      if (validateRange(this.def, offset, limit)) {
        this.def.range.offset = 0
        this.def.range.limit = DEF_RANGE_PROP_LIMIT
        // @ts-ignore
        return this
      }
      this.def.range.offset = offset
      this.def.range.limit = limit
    }
    // @ts-ignore
    return this
  }

  include(...fields: (string | BranchInclude | string[])[]): T {
    if (this.queryCommands) {
      this.queryCommands.push({ method: 'include', args: fields })
    } else {
      for (const f of fields) {
        if (typeof f === 'string') {
          includeField(this.def, f)
        } else if (typeof f === 'function') {
          f((field: string) => {
            if (field[0] == '$') {
              // @ts-ignore
              const prop = this.def.target?.propDef?.edges[field]
              if (
                prop &&
                (prop.typeIndex === REFERENCE || prop.typeIndex === REFERENCES)
              ) {
                const refDef = createOrGetEdgeRefQueryDef(
                  this.db,
                  this.def,
                  prop,
                )
                // @ts-ignore
                return new QueryBranch(this.db, refDef)
              }
              throw new Error(
                `No edge reference or edge references field named "${field}"`,
              )
            } else {
              const prop =
                field[0] == '$'
                  ? // @ts-ignore
                    this.def.target?.propDef?.edges[field]
                  : this.def.props[field]
              if (
                prop &&
                (prop.typeIndex === REFERENCE || prop.typeIndex === REFERENCES)
              ) {
                const refDef = createOrGetRefQueryDef(this.db, this.def, prop)
                // @ts-ignore
                return new QueryBranch(this.db, refDef)
              }
              throw new Error(
                `No reference or references field named "${field}"`,
              )
            }
          })
        } else if (Array.isArray(f)) {
          if (f.length === 0) {
            includeFields(this.def, ['id'])
          } else {
            includeFields(this.def, f)
          }
        } else if (f !== undefined) {
          throw new Error(
            'Invalid include statement: expected props, refs and edges (string or array) or function',
          )
        }
      }
    }
    // @ts-ignore
    return this
  }
}

export class BasedDbReferenceQuery extends QueryBranch<BasedDbReferenceQuery> {}

const resToJSON = (res: BasedQueryResponse) => res.toJSON()
const resToObject = (res: BasedQueryResponse) => res.toObject()

class GetPromise extends Promise<BasedQueryResponse> {
  toObject() {
    return this.then(resToObject)
  }
  toJSON() {
    return this.then(resToJSON)
  }
  inspect(depth?: number, raw?: boolean) {
    return this.then(
      (res: BasedQueryResponse) =>
        new GetPromise((resolve) => resolve(res.inspect(depth, raw))),
    ) as GetPromise
  }
}

export class BasedDbQuery extends QueryBranch<BasedDbQuery> {
  skipValidation = false
  target: QueryTarget
  constructor(
    db: DbClient,
    type: string,
    rawTarget?:
      | QueryByAliasObj
      | number
      | Uint32Array
      | (QueryByAliasObj | number)[],
    skipValidation?: boolean, // for internal use
  ) {
    const target: QueryTarget = {
      type,
    }

    if (rawTarget) {
      if (isAlias(rawTarget)) {
        target.alias = rawTarget
      } else {
        if (Array.isArray(rawTarget) || rawTarget instanceof Uint32Array) {
          // TODO ADD MULTI ALIAS
          // @ts-ignore
          target.ids = rawTarget
        } else {
          target.id = rawTarget
        }
      }
    }

    // const def = createQueryDef(db, QueryDefType.Root, target, skipValidation)
    // def.schemaChecksum = db.schema?.hash || 0

    //  def: QueryDef

    super(db)
    this.db = db
    this.skipValidation = skipValidation
    this.queryCommands = []
    this.target = target
  }

  reset() {
    this.id = undefined
    this.buffer = undefined
    this.def = undefined
  }

  #getInternal = async (resolve, reject) => {
    let buf: Uint8Array
    try {
      if (!this.db.schema) {
        await this.db.once('schema')
      }
      buf = registerQuery(this)
    } catch (err) {
      reject(err)
      return
    }

    const d = performance.now()

    await this.db.isModified()

    if (this.db.schema?.hash !== this.def.schemaChecksum) {
      this.reset()
      return this.#getInternal(resolve, reject)
    }
    const res = await this.db.hooks.getQueryBuf(buf)

    if (res.byteLength === 1) {
      if (res[0] === 0) {
        if (this.def && this.db.schema?.hash !== this.def.schemaChecksum) {
          this.reset()
          this.db.emit(
            'info',
            'query get schema mismatch - awaiting new schema',
          )
          await this.db.once('schema')
          return this.#getInternal(resolve, reject)
        } else {
          this.db.emit(
            'info',
            'query get schema mismatch - got the same already',
          )
          this.reset()
          return this.#getInternal(resolve, reject)
        }
      } else {
        reject(new Error('unexpected error'))
      }
    } else if (res instanceof Error) {
      reject(res)
    } else {
      resolve(
        new BasedQueryResponse(this.id, this.def, res, performance.now() - d),
      )
    }
  }

  // if !id not initialized yet
  id: number

  get(): GetPromise {
    return new GetPromise(this.#getInternal)
  }

  buffer: Uint8Array

  register() {
    registerQuery(this)
  }

  locale(locale: LangName) {
    if (this.queryCommands) {
      this.queryCommands.push({
        method: 'locale',
        args: [locale],
      })
    } else {
      validateLocale(this.def, locale)
      this.def.lang = langCodesMap.get(locale) ?? 0
    }
    return this
  }

  subscribe(onData: OnData, onError?: OnError) {
    return subscribe(
      this,
      (res) => {
        try {
          onData(res)
        } catch (err) {
          // const t = displayTarget(this.def)
          const def = this.def
          let name = picocolors.red(`QueryError[${displayTarget(def)}]\n`)
          name += `  Error executing onData handler in subscription\n`
          name += `  ${err.message}\n`
          console.error(name)
        }
      },
      onError ??
        ((err) => {
          console.error(err)
        }),
    )
  }

  _getSync(dbCtxExternal: any) {
    const buf = registerQuery(this)
    const d = performance.now()
    const res = native.getQueryBuf(buf, dbCtxExternal)
    return new BasedQueryResponse(
      this.id,
      this.def,
      new Uint8Array(res),
      performance.now() - d,
    )
  }
}
