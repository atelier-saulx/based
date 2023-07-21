export type Id = string

type Inherit =
  | boolean
  | {
      $type?: string | string[]
      $item?: Id | Id[]
      $merge?: boolean
      $deepMerge?: boolean
      $required?: Id | Id[]
    }
type GeoFilter = {
  $operator: 'distance'
  $field: string
  $value: {
    $lat: number
    $lon: number
    $radius: number
  }
  $and?: Filter
  $or?: Filter
}
type ExistsFilter = {
  $operator: 'exists' | 'notExists'
  $field: string
  $value?: undefined
  $and?: Filter
  $or?: Filter
}
export type Filter =
  | ExistsFilter
  | GeoFilter
  | {
      $operator:
        | '='
        | '!='
        | '>'
        | '<'
        | '..'
        | 'has'
        | 'includes'
        | 'textSearch'
      $field: string
      $value: string | number | (string | number)[]
      $and?: Filter
      $or?: Filter
    }
type TraverseOptions = {
  $db?: string
  $id?: string
  $field: string
}
type TraverseByTypeExpression =
  | false
  | string
  | {
      $first?: TraverseByTypeExpression[]
      $all?: TraverseByTypeExpression[]
    }
type TraverseByType = {
  $any: TraverseByTypeExpression
  [k: string]: TraverseByTypeExpression
}
type Find = {
  $db?: string
  $traverse?:
    | 'descendants'
    | 'ancestors'
    | string
    | string[]
    | TraverseOptions
    | TraverseByType
  $recursive?: boolean
  $filter?: Filter | Filter[]
  $find?: Find
}
type Aggregate = {
  $db?: string
  $traverse?:
    | 'descendants'
    | 'ancestors'
    | string
    | string[]
    | TraverseOptions
    | TraverseByType
  $filter?: Filter | Filter[]
  $recursive?: boolean
  $function?:
    | string
    | {
        $name: string
        $args: string[]
      }
  $find?: Find
  $sort?: Sort
  $offset?: number
  $limit?: number
}
export type Sort = {
  $field: string
  $order?: 'asc' | 'desc'
}
type List =
  | true
  | {
      $offset?: number
      $limit?: number
      $sort?: Sort | Sort[]
      $find?: Find
      $aggregate?: Aggregate
      $inherit?: Inherit
    }
type GetField<T> = {
  $field?: string | string[]
  $inherit?: Inherit
  $list?: List
  $find?: Find
  $aggregate?: Aggregate
  $default?: T
  $all?: boolean
  $value?: any
}
type Item = {
  [key: string]: any
}
type GetItem<T = Item> = {
  [P in keyof T]?: T[P] extends Item[]
    ? GetItem<T>[] | true
    : T[P] extends object
    ? (GetItem<T[P]> & GetField<T>) | true
    : T[P] extends number
    ? T[P] | GetField<T[P]> | true
    : T[P] extends string
    ? T[P] | GetField<T[P]> | true
    : T[P] extends boolean
    ? T[P] | GetField<T[P]>
    : (T[P] & GetField<T[P]>) | true
} & GetField<T> & {
    [key: string]: any
  }

export type GetOptions = GetItem & {
  $trigger?: {
    $event: 'created' | 'updated' | 'deleted'
    $filter?: Filter
  }
  $id?: Id | Id[]
  $alias?: string | string[]
  $version?: string
  $language?: string
  $rawAncestors?: true
}

type BaseItem = {
  [key: string]: any
}
type ExternalId = string
type RedisSetParams =
  | Id[]
  | {
      $value?: string[] | Id
      $add?: Id[] | Id | SetItem[]
      $delete?: Id[] | Id | true
      $noRoot?: boolean
    }
type HierarchySet = RedisSetParams & {
  $hierarchy?: boolean
}
type SetExtraOptions<T> = {
  $default?: T
  $value?: T
  $merge?: boolean
  $field?: string | string[]
  $source?:
    | string
    | {
        $overwrite?: boolean | string[]
        $name: string
      }
}
type SetExtraCounterOptions = {
  $increment?: number
}
type SetItem<T = BaseItem> = {
  [P in keyof T]?: T[P] extends BaseItem[]
    ? SetItem<T>[]
    : T[P] extends object
    ? SetItem<T[P]> & SetExtraOptions<T>
    : T[P] extends number
    ? T[P] | (SetExtraOptions<T[P]> & SetExtraCounterOptions)
    : T[P] extends string
    ? T[P] | SetExtraOptions<T[P]>
    : T[P] extends boolean
    ? T[P] | SetExtraOptions<T[P]>
    : T[P] | (T[P] & SetExtraOptions<T[P]>)
}
type BatchRefFieldOpts = {
  resetReference?: string
  last?: boolean
}
type BatchOpts = {
  batchId: string
  refField?: BatchRefFieldOpts
  last?: boolean
}
export type SetOptions = SetItem & {
  $id?: Id
  $operation?: 'upsert' | 'insert' | 'update'
  // eslint-disable-next-line
  $_batchOpts?: BatchOpts
  $language?: string
  $merge?: boolean
  $version?: string
  children?: HierarchySet | SetItem[]
  parents?: HierarchySet | SetItem[]
  externalId?:
    | ExternalId[]
    | {
        $add?: ExternalId[] | ExternalId
        $delete?: ExternalId[] | ExternalId
        $value?: ExternalId[]
      }
  auth?: {
    password?: string
    google?: string
    facebook?: string
    role?: {
      id?: RedisSetParams
      type?: 'admin' | 'owner' | 'user'
    }
  }
}
