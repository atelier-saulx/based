import type { ResolvedProps } from '../../schema/index.js'
import type { TypedArray } from '../../schema/index.js'

export type GetLocales<Schema extends { locales?: any }> = Schema['locales'] extends
  | string
  | Record<string, any>
  ? Schema['locales']
  : {}

export type InferSchemaOutput<
  Schema extends { types: any; locales?: any },
  Type extends keyof Schema['types'],
> = InferType<ResolvedProps<Schema['types'], Type>, Schema> & { id: number }

type TypeMap = {
  string: string
  number: number
  int8: number
  uint8: number
  int16: number
  uint16: number
  int32: number
  uint32: number
  boolean: boolean
  json: any
  timestamp: number
  binary: Uint8Array
  alias: string
  vector: TypedArray
  colvec: TypedArray
  cardinality: number
}

type LocalizedString = { type: 'string'; localized: true }

// Helper to check if Selection is provided (not never/any/unknown default behavior)
type IsSelected<Type> = [Type] extends [never] ? false : true

export type FilterEdges<Type> = {
  [Key in keyof Type as Key extends `$${string}` ? Key : never]: Type[Key]
}

// Utility to clean up intersection types
type Prettify<Type> = {
  [Key in keyof Type]: Type[Key]
} & {}

type PickOutputFromProps<
  Schema extends { types: any; locales?: any },
  Props,
  Select,
> = Prettify<
  {
    [Prop in Extract<Select, keyof Props & string> | 'id']: Prop extends 'id'
      ? number
      : Prop extends keyof Props
        ? IsRefProp<Props[Prop]> extends true
          ? InferProp<Props[Prop], Schema, '*'>
          : InferProp<Props[Prop], Schema>
        : never
  } & {
    [Field in Extract<Select, { field: any; select: any }>['field'] &
      keyof Props]: InferProp<
      Props[Field],
      Schema,
      Extract<Select, { field: Field; select: any }>['select']
    >
  }
>

export type InferProp<
  Prop,
  Schema extends { types: any; locales?: any },
  Selection = never,
> =
  IsSelected<Selection> extends false
    ? InferPropLogic<Prop, Schema, Selection>
    : [Selection] extends [{ _aggregate: infer Agg }]
      ? Agg
      : InferPropLogic<Prop, Schema, Selection>

type InferPropLogic<
  Prop,
  Schema extends { types: any; locales?: any },
  Selection = never,
> = Prop extends LocalizedString
  ? GetLocales<Schema> extends string
    ? string
    : { [Key in Exclude<keyof GetLocales<Schema>, symbol | number>]-?: string }
  : Prop extends { type: 'object'; props: infer Prop }
    ? InferType<Prop, Schema>
    : Prop extends { type: infer Type extends keyof TypeMap }
      ? TypeMap[Type]
      : Prop extends { enum: infer EnumValues extends readonly any[] }
        ? EnumValues[number] | null
        : Prop extends { ref: infer Ref extends string }
          ? IsSelected<Selection> extends true
            ? Ref extends keyof Schema['types']
              ? PickOutputFromProps<
                  Schema,
                  ResolvedProps<Schema['types'], Ref> & FilterEdges<Prop>,
                  ResolveInclude<
                    ResolvedProps<Schema['types'], Ref> & FilterEdges<Prop>,
                    Selection
                  >
                > | null
              : never
            : number // ID
          : Prop extends {
                items: { ref: infer Ref extends string } & infer Items
              }
            ? IsSelected<Selection> extends true
              ? Ref extends keyof Schema['types']
                ? PickOutputFromProps<
                    Schema,
                    ResolvedProps<Schema['types'], Ref> & FilterEdges<Items>,
                    ResolveInclude<
                      ResolvedProps<Schema['types'], Ref> & FilterEdges<Items>,
                      Selection
                    >
                  >[]
                : never
              : number[] // IDs
            : unknown

type InferType<Props, Schema extends { types: any; locales?: any }> = {
  [Key in keyof Props]: InferProp<Props[Key], Schema>
}

// Helpers for include
type IsRefProp<Prop> = [Prop] extends [{ type: 'reference' } | { type: 'references' }]
  ? true
  : [Prop] extends [{ ref: any }]
    ? true
    : [Prop] extends [{ items: { ref: any } }]
      ? true
      : false

export type NonRefKeys<Props> = {
  [Key in keyof Props]: IsRefProp<Props[Key]> extends true ? never : Key
}[keyof Props]

export type RefKeys<Props> = {
  [Key in keyof Props]: IsRefProp<Props[Key]> extends true ? Key : never
}[keyof Props]

export type ResolveInclude<Props, Select> = Select extends any
  ? Select extends '*'
    ? NonRefKeys<Props>
    : Select extends '**'
      ? RefKeys<Props>
      : Select
  : never

export type PickOutput<
  Schema extends { types: any; locales?: any },
  Type extends keyof Schema['types'],
  Select,
> = PickOutputFromProps<Schema, ResolvedProps<Schema['types'], Type>, Select>

export type FilterOpts = {
  lowerCase?: boolean
  fn?:
    | 'dotProduct'
    | 'manhattanDistance'
    | 'cosineSimilarity'
    | 'euclideanDistance'
  score?: number
}

export type Operator =
  | '='
  | '<'
  | '>'
  | '!='
  | '>='
  | '<='
  | '..'
  | '!..'
  | 'exists'
  | '!exists'
  | 'like'
  | '!like'
  | 'includes'
  | '!includes'

type Prev = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

// Helper to generate paths from edges
type EdgePaths<
  Schema extends { types: any; locales?: any },
  Prop,
  Depth extends number,
> = {
  [Key in keyof FilterEdges<Prop> & string]:
    | Key
    | (FilterEdges<Prop>[Key] extends { ref: infer Ref extends string }
        ? `${Key}.${Path<Schema, Ref & keyof Schema['types'], Depth> | 'id' | '*' | '**'}`
        : FilterEdges<Prop>[Key] extends {
              items: { ref: infer Ref extends string }
            }
          ? `${Key}.${Path<Schema, Ref & keyof Schema['types'], Depth> | 'id' | '*' | '**'}`
          : never)
}[keyof FilterEdges<Prop> & string]

type PropsPath<
  Schema extends { types: any; locales?: any },
  Props,
  Depth extends number,
> = [Depth] extends [never]
  ? never
  : {
      [Key in keyof Props & string]:
        | Key
        | (Props[Key] extends { ref: infer Ref extends string }
            ? `${Key}.${
                | Path<Schema, Ref & keyof Schema['types'], Prev[Depth]>
                | EdgePaths<Schema, Props[Key], Prev[Depth]>
                | 'id'
                | '*'
                | '**'}`
            : Props[Key] extends { props: infer Prop }
              ? `${Key}.${PropsPath<Schema, Prop, Prev[Depth]>}`
              : Props[Key] extends LocalizedString
                ? Schema['locales'] extends string
                  ? never
                  : `${Key}.${keyof GetLocales<Schema> & string}`
                : Props[Key] extends {
                      items: { ref: infer Ref extends string } & infer Items
                    }
                  ? `${Key}.${
                      | Path<Schema, Ref & keyof Schema['types'], Prev[Depth]>
                      | EdgePaths<Schema, Items, Prev[Depth]>
                      | 'id'
                      | '*'
                      | '**'}`
                  : never)
    }[keyof Props & string]

export type Path<
  Schema extends { types: any; locales?: any },
  Type extends keyof Schema['types'],
  Depth extends number = 5,
> = PropsPath<Schema, ResolvedProps<Schema['types'], Type>, Depth>

export type ResolveDotPath<PathItem extends string> =
  PathItem extends `${infer Head}.${infer Tail}`
    ? { field: Head; select: ResolveDotPath<Tail> }
    : PathItem

type InferPropsPathType<
  Schema extends { types: any; locales?: any },
  Props,
  Prop,
> = Prop extends 'id'
  ? number
  : Prop extends keyof Props
    ? InferProp<Props[Prop], Schema>
    : Prop extends `${infer Head}.${infer Tail}`
      ? Head extends keyof Props
        ? Props[Head] extends { ref: infer Ref extends string }
          ? Tail extends keyof FilterEdges<Props[Head]>
            ? InferProp<Props[Head][Tail & keyof Props[Head]], Schema>
            : InferPathType<Schema, Ref & keyof Schema['types'], Tail>
          : Props[Head] extends { props: infer NestedProps }
            ? InferPropsPathType<Schema, NestedProps, Tail>
            : Props[Head] extends LocalizedString
              ? Schema['locales'] extends string
                ? never
                : Tail extends keyof GetLocales<Schema>
                  ? string
                  : never
              : Props[Head] extends {
                    items: { ref: infer Ref extends string } & infer Items
                  }
                ? Tail extends keyof FilterEdges<Items>
                  ? InferProp<Items[Tail & keyof Items], Schema>
                  : InferPathType<Schema, Ref & keyof Schema['types'], Tail>
                : never
        : never
      : never

export type InferPathType<
  Schema extends { types: any; locales?: any },
  Type extends keyof Schema['types'],
  Prop,
  EdgeProps extends Record<string, any> = {},
> = InferPropsPathType<Schema, ResolvedProps<Schema['types'], Type> & EdgeProps, Prop>

export type NumberPaths<
  Schema extends { types: any; locales?: any },
  Type extends keyof Schema['types'],
> = {
  [Key in Path<Schema, Type>]: InferPathType<Schema, Type, Key> extends number ? Key : never
}[Path<Schema, Type>]

export type SortablePaths<
  Schema extends { types: any; locales?: any },
  Type extends keyof Schema['types'],
  EdgeProps extends Record<string, any> = {},
> = {
  [Key in Path<Schema, Type>]: InferPathType<Schema, Type, Key, EdgeProps> extends
    | string
    | number
    | Uint8Array
    | boolean
    | null
    ? Key
    : never
}[Path<Schema, Type>]

export type ExpandDotPath<
  PathItem extends string,
  Value,
> = PathItem extends `${infer Head}.${infer Tail}`
  ? { [Key in Head]: ExpandDotPath<Tail, Value> }
  : { [Key in PathItem]: Value }

export type UnionToIntersection<UnionType> = (
  UnionType extends any ? (k: UnionType) => void : never
) extends (k: infer IntersectionType) => void
  ? IntersectionType
  : never
