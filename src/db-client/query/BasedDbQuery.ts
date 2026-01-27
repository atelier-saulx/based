import {
  QueryDef,
  QueryTarget,
  sort,
  type QueryByAliasObj,
  isAlias,
  addAggregate,
  groupBy,
  LangFallback,
  IncludeOpts,
} from './query.js'
import { BasedQueryResponse } from './BasedQueryResponse.js'
// import { search, Search, vectorSearch } from './search/index.js'
import { subscribe, OnData, OnError } from './subscription/index.js'
import { registerQuery } from './registerQuery.js'
import { DbClient } from '../index.js'
import { FilterOpts, Operator } from './filter/types.js'
import { validateLocale, validateRange } from './validation.js'
import { DEF_RANGE_PROP_LIMIT } from './thresholds.js'
import { StepInput, aggFnOptions } from './aggregates/types.js'
import { displayTarget } from './display.js'
import { include } from './include/include.js'
import { type ReaderSchema } from '../../protocol/index.js'
import {
  LangCode,
  LangCodeEnum,
  Order,
  AggFunction,
} from '../../zigTsExports.js'
import { styleText } from 'node:util'
import { filter, or } from './filter/filter.js'

export { QueryByAliasObj }

export type SelectFn = (field: string) => BasedDbReferenceQuery

export type BranchInclude = (select: SelectFn) => any

export type QueryCommand = {
  method: string
  args: any[]
}

export class QueryBranch<T> {
  db: DbClient
  def?: QueryDef
  queryCommands?: QueryCommand[]

  constructor(db: DbClient, def?: QueryDef) {
    this.db = db
    this.def = def
  }

  sort(field: string): T {
    if (this.queryCommands) {
      this.queryCommands.push({
        method: 'sort',
        args: [field],
      })
    } else {
      sort(this.def!, field)
    }
    // @ts-ignore
    return this
  }

  order(order: 'asc' | 'desc') {
    if (this.queryCommands) {
      this.queryCommands.unshift({
        method: 'order',
        args: [order],
      })
    } else {
      this.def!.order = order === 'desc' ? Order.desc : Order.asc
    }
    // @ts-ignore
    return this
  }

  // or(fn: FilterBranchFn): T
  // or(
  //   field: string,
  //   operator?: Operator | boolean,
  //   value?: any,
  //   opts?: FilterOpts,
  // ): T
  // or(
  //   field: string | FilterBranchFn,
  //   operator?: Operator | boolean,
  //   value?: any,
  //   opts?: FilterOpts,
  // ): T {
  //   if (this.queryCommands) {
  //     this.queryCommands.push({
  //       method: 'or',
  //       args: [field, operator, value, opts],
  //     })
  //   } else {
  //     const def = this.def!
  //     if (typeof field === 'function') {
  //       const f = new FilterBranch(
  //         this.db,
  //         filterOr(this.db, def, [], def.filter),
  //         def,
  //       )
  //       field(f)
  //       def.filter.size += f.filterBranch.size
  //     } else {
  //       const f = convertFilter(this, field, operator, value, opts)
  //       if (f) {
  //         filterOr(this.db, def, f, def.filter)
  //       }
  //     }
  //   }
  //   // @ts-ignore
  //   return this
  // }

  // going to support a fn for both filter and or
  filter(
    field: string,
    operator?: Operator,
    value?: any,
    opts?: FilterOpts,
  ): T {
    if (this.queryCommands) {
      this.queryCommands.push({
        method: 'filter',
        args: [field, operator, value, opts],
      })
    } else {
      filter(
        this.db,
        this.def!.filterContinue ?? this.def?.filter!,
        field,
        operator,
        value,
        opts,
      )
    }
    // @ts-ignore
    return this
  }

  and(field: string, operator?: Operator, value?: any, opts?: FilterOpts): T {
    if (this.queryCommands) {
      this.queryCommands.push({
        method: 'and',
        args: [field, operator, value, opts],
      })
    } else {
      if (!this.def!.filterContinue && !this.def!.filter.conditions.size) {
        throw new Error('.and() needs to continue from another filter')
      }
      filter(
        this.db,
        this.def!.filterContinue ?? this.def?.filter!,
        field,
        operator,
        value,
        opts,
      )
    }
    // @ts-ignore
    return this
  }

  // and can be a shortcut for filter 🤷🏻‍♂️
  // going to support a fn for both filter and or
  or(field: string, operator?: Operator, value?: any, opts?: FilterOpts): T {
    if (this.queryCommands) {
      this.queryCommands.push({
        method: 'or',
        args: [field, operator, value, opts],
      })
    } else {
      this.def!.filterContinue = or(
        this.db,
        this.def!.filterContinue ?? this.def?.filter!,
        field,
        operator,
        value,
        opts,
      )
    }
    // @ts-ignore
    return this
  }
  // .or and .and

  // search(query: string, ...fields: Search[]): T

  // search(
  //   query: ArrayBufferView,
  //   field: string,
  //   opts?: Omit<FilterOpts, 'lowerCase'>,
  // ): T

  // search(
  //   query: string | ArrayBufferView,
  //   field?: Search | string,
  //   opts?: Omit<FilterOpts, 'lowerCase'> | Search,
  //   ...fields: Search[]
  // ): T {
  //   if (this.queryCommands) {
  //     this.queryCommands.push({
  //       method: 'search',
  //       args: [query, field, opts, ...fields],
  //     })
  //   } else {
  //     if (ArrayBuffer.isView(query)) {
  //       // @ts-ignore
  //       vectorSearch(this.def, query, field, opts ?? {})
  //       // @ts-ignore
  //       return this
  //     }

  //     if (field) {
  //       if (!fields) {
  //         // @ts-ignore
  //         fields = [field]
  //       } else {
  //         // @ts-ignore
  //         fields.unshift(field)
  //       }
  //     }

  //     if (opts) {
  //       if (!fields) {
  //         // @ts-ignore
  //         fields = [opts]
  //       } else {
  //         // @ts-ignore
  //         fields.unshift(opts)
  //       }
  //     }

  //     if (fields.length) {
  //       if (fields.length === 1) {
  //         search(this, query, fields[0])
  //       } else {
  //         const s = {}
  //         for (const f of fields) {
  //           if (typeof f === 'string') {
  //             s[f] = 0
  //           } else if (Array.isArray(f)) {
  //             for (const ff of f) {
  //               s[ff] = 0
  //             }
  //           } else if (typeof f === 'object') {
  //             Object.assign(s, f)
  //           }
  //         }
  //         search(this, query, s)
  //       }
  //     } else {
  //       search(this, query)
  //     }
  //   }

  //   // @ts-ignore
  //   return this
  // }

  groupBy(field: string, step?: StepInput): T {
    if (this.queryCommands) {
      this.queryCommands.push({
        method: 'groupBy',
        args: [field, step],
      })
    } else {
      groupBy(this, field, step)
    }
    // only works with aggregates for now
    // @ts-ignore
    return this
  }

  count(): T {
    const fields: string[] = ['count']
    if (this.queryCommands) {
      this.queryCommands.push({
        method: 'count',
        args: fields,
      })
    } else {
      addAggregate(this, AggFunction.count, fields)
    }
    // @ts-ignore
    return this
  }

  sum(...fields: string[]): T {
    if (fields.length === 0) {
      throw new Error('Empty sum() called')
    }

    if (this.queryCommands) {
      this.queryCommands.push({
        method: 'sum',
        args: fields,
      })
    } else {
      addAggregate(this, AggFunction.sum, fields)
    }
    // @ts-ignore
    return this
  }

  cardinality(...fields: string[]): T {
    if (fields.length === 0) {
      throw new Error('Empty cardinality() called')
    }

    if (this.queryCommands) {
      this.queryCommands.push({
        method: 'cardinality',
        args: fields,
      })
    } else {
      addAggregate(this, AggFunction.cardinality, fields)
    }
    // @ts-ignore
    return this
  }

  stddev(...args: (string | aggFnOptions)[]): T {
    if (this.queryCommands) {
      this.queryCommands.push({
        method: 'stddev',
        args,
      })
    } else {
      let option: aggFnOptions = {}
      let fields: string[]

      const lastArg = args[args.length - 1]
      const lastArgIsOptions = typeof lastArg === 'object' && lastArg !== null

      if (lastArgIsOptions) {
        option = lastArg as aggFnOptions
        fields = args.slice(0, -1) as string[]
      } else {
        fields = args as string[]
      }

      if (fields.length === 0) {
        throw new Error('Empty standard deviation function called')
      }
      addAggregate(this, AggFunction.stddev, fields, option)
    }
    // @ts-ignore
    return this
  }

  var(...args: (string | aggFnOptions)[]): T {
    if (this.queryCommands) {
      this.queryCommands.push({
        method: 'var',
        args,
      })
    } else {
      let option: aggFnOptions = {}
      let fields: string[] = []

      const lastArg = args[args.length - 1]
      const lastArgIsOptions = typeof lastArg === 'object' && lastArg !== null

      if (lastArgIsOptions) {
        option = lastArg as aggFnOptions
        fields = args.slice(0, -1) as string[]
      } else {
        fields = args as string[]
      }

      if (fields.length === 0) {
        throw new Error('Empty variance called')
      }
      addAggregate(this, AggFunction.variance, fields, option)
    }
    // @ts-ignore
    return this
  }

  avg(...fields: string[]): T {
    if (fields.length === 0) {
      throw new Error('Empty average function called')
    }
    if (this.queryCommands) {
      this.queryCommands.push({
        method: 'avg',
        args: fields,
      })
    } else {
      addAggregate(this, AggFunction.avg, fields)
    }
    // @ts-ignore
    return this
  }

  harmonicMean(...fields: string[]): T {
    if (fields.length === 0) {
      throw new Error('Empty harmonic mean function called')
    }

    if (this.queryCommands) {
      this.queryCommands.push({
        method: 'harmonicMean',
        args: fields,
      })
    } else {
      addAggregate(this, AggFunction.hmean, fields)
    }
    // @ts-ignore
    return this
  }

  max(...fields: string[]): T {
    if (fields.length === 0) {
      throw new Error('Empty maximum function called')
    }

    if (this.queryCommands) {
      this.queryCommands.push({
        method: 'max',
        args: fields,
      })
    } else {
      addAggregate(this, AggFunction.max, fields)
    }
    // @ts-ignore
    return this
  }

  min(...fields: string[]): T {
    if (fields.length === 0) {
      throw new Error('Empty minimum function called')
    }

    if (this.queryCommands) {
      this.queryCommands.push({
        method: 'min',
        args: fields,
      })
    } else {
      addAggregate(this, AggFunction.min, fields)
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
      const def = this.def!
      if (validateRange(def, offset, limit)) {
        def.range.offset = 0
        def.range.limit = DEF_RANGE_PROP_LIMIT
        // @ts-ignore
        return this
      }
      def.range.offset = offset
      def.range.limit = limit
    }
    // @ts-ignore
    return this
  }

  // first() {
  //   if (this.queryCommands) {
  //     this.queryCommands.push({ method: 'first', args: [] })
  //   } else {
  //     const offset = 0
  //     const limit = 1
  //     this.def.range.offset = offset
  //     this.def.range.limit = limit
  //   }
  //   // @ts-ignore
  //   return this
  // }

  include(
    ...fields: (
      | string
      | BranchInclude
      | IncludeOpts
      | (string | IncludeOpts)[]
    )[]
  ): T {
    if (this.queryCommands) {
      this.queryCommands.push({ method: 'include', args: fields })
    } else {
      include(this, fields)
      const def = this.def!
      if (def.schema!.propHooks?.include) {
        for (const field of def.include.stringFields.keys()) {
          const hooks = def.schema!.props[field]?.hooks
          const includeHook = hooks?.include
          if (includeHook) {
            hooks.include = undefined
            includeHook(this, def.include.stringFields)
            hooks.include = includeHook
          }
        }
      }
      const includeHook = def.schema!.hooks?.include
      if (includeHook) {
        def.schema!.hooks!.include = undefined
        includeHook(this, def.include.stringFields)
        def.schema!.hooks!.include = includeHook
      }
    }
    // @ts-ignore
    return this
  }
}

export class BasedDbReferenceQuery extends QueryBranch<BasedDbReferenceQuery> {}

const resToJSON = (
  res: BasedQueryResponse,
  replacer?: (this: any, key: string, value: any) => any,
  space?: string | number,
) => res.toJSON(replacer, space)
const resToObject = (res: BasedQueryResponse) => res.toObject()

class GetPromise extends Promise<BasedQueryResponse> {
  toObject() {
    return this.then(resToObject)
  }
  toJSON(
    replacer?: (this: any, key: string, value: any) => any,
    space?: string | number,
  ) {
    return this.then((res) => resToJSON(res, replacer, space))
  }
  inspect(depth?: number, raw?: boolean) {
    return this.then(
      (res: BasedQueryResponse) =>
        new GetPromise((resolve) => resolve(res.inspect(depth, raw))),
    ) as GetPromise
  }
  debug(depth?: number, raw?: boolean) {
    return this.then(
      (res: BasedQueryResponse) =>
        new GetPromise((resolve) => resolve(res.debug())),
    ) as GetPromise
  }
}

export class BasedDbQuery extends QueryBranch<BasedDbQuery> {
  skipValidation?: boolean = false
  target: QueryTarget
  readSchema: ReaderSchema
  constructor(
    db: DbClient,
    type: string,
    rawTarget?:
      | QueryByAliasObj
      | number
      | Promise<number>
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

    super(db)
    this.db = db
    this.skipValidation = skipValidation
    this.queryCommands = []
    this.target = target
  }

  at(index: number): BasedDbQuery {
    if (this.queryCommands) {
      this.queryCommands.push({
        method: 'at',
        args: [index],
      })
    } else {
      const def = this.def!
      def.selectFirstResult = true
      def.range.limit = 1
      def.range.offset = index
    }
    return this
  }

  reset() {
    this.subscriptionBuffer = undefined
    this.buffer = undefined
    this.def = undefined
  }

  #getInternal = async (resolve, reject) => {
    let buf: Uint8Array
    try {
      if (!this.db.schema) {
        await this.db.once('schema')
      }
      if ('id' in this.target) {
        this.target.id = await this.target.id
      }
      buf = registerQuery(this)
    } catch (err) {
      reject(err)
      return
    }

    await this.db.isModified()

    if (this.db.schema?.hash !== this.def!.schemaChecksum) {
      this.reset()
      return this.#getInternal(resolve, reject)
    }
    const d = performance.now()

    const res = await this.db.hooks.getQueryBuf(buf)

    if (res.byteLength === 1) {
      if (res[0] === 0) {
        if (this.def && this.def.schemaChecksum === this.db.schema?.hash) {
          // my schema did not change since last time, wait for the schema to change
          this.reset()
          this.db.emit(
            'info',
            'query get schema mismatch - awaiting new schema',
          )
          await this.db.once('schema')
          return this.#getInternal(resolve, reject)
        } else {
          // its changed so lets send again
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
      resolve(new BasedQueryResponse(this.def!, res, performance.now() - d))
    }
  }

  get(): GetPromise {
    return new GetPromise(this.#getInternal)
  }

  buffer?: Uint8Array
  subscriptionBuffer?: Uint8Array

  register() {
    registerQuery(this)
  }

  locale(locale: keyof typeof LangCode, fallBacks?: LangFallback[]) {
    if (this.queryCommands) {
      this.queryCommands.unshift({
        method: 'locale',
        args: [locale, fallBacks],
      })
    } else {
      const def = this.def!
      if (fallBacks === undefined) {
        // Uses fallback from schema if available
        const localeDescriptor = def.schema!.locales![locale]
        fallBacks =
          typeof localeDescriptor === 'object'
            ? localeDescriptor.fallback || false
            : false
      }
      validateLocale(def, locale)
      def.lang = {
        lang: LangCode[locale] ?? 0,
        fallback:
          fallBacks === undefined
            ? []
            : // @ts-ignore
              fallBacks.map((code: LangCodeEnum) => LangCode[code]),
      }
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
          const def = this.def!
          let name = styleText('red', `QueryError[${displayTarget(def)}]\n`)
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
}
