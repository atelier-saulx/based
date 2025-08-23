import {
  ENUM,
  PropDef,
  PropDefEdge,
  TypeIndex,
  VECTOR,
} from '@based/schema/def'
import { IncludeOpts, QueryDef, QueryDefType, Target } from '../types.js'

export type Item = {
  id: number
} & { [key: string]: any }

export type Meta = {
  checksum: number
  size: number
  crc32: number
  compressed: boolean
  value?: any
}

export type AggItem = Partial<Item>

export type TypedArray =
  | Int8Array
  | Uint8Array
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array

export type ReadInstruction = (
  id: number,
  q: ReaderSchema,
  result: Uint8Array,
  i: number,
  item: Item,
) => number

// get string names of props
// edge & non edge
// prop has meta (only or all)
// aggregate
// query target (id or alias or non) + type
// has search
// references have to have this nested
// main info (all or specific)

/*
  propDef
    // __isEdge optional can prop do this better
    path
    typeIndex
*/

// need inverseLangCodes that are relevant

export type ReaderPropDef = {
  path: string[]
  typeIndex: TypeIndex
  hasMeta?: boolean
  enum?: any[]
  vectorBaseType?: PropDef['vectorBaseType']
}

export enum ReaderSchemaEnum {
  edge = 1,
  default = 2,
  single = 3,
  rootProps = 4,
}

export type ReaderSchema = {
  props: { [prop: string]: ReaderPropDef }
  main: { props: { [start: string]: ReaderPropDef }; len: number }
  type: ReaderSchemaEnum
  refs: {
    [prop: string]: {
      schema: ReaderSchema
      prop: ReaderPropDef
    }
  }
  edges?: ReaderSchema
  // langCodeToString: { [langCode: string]: string }
  // =============
  hasSearch?: boolean
}

const createReaderPropDef = (
  p: PropDef | PropDefEdge,
  opts?: IncludeOpts,
): ReaderPropDef => {
  const readerPropDef: ReaderPropDef = {
    path: p.__isEdge ? p.path.slice(1) : p.path,
    typeIndex: p.typeIndex,
    hasMeta: opts?.meta ? true : false,
  }
  if (p.typeIndex === ENUM) {
    readerPropDef.enum = p.enum
  }
  if (p.typeIndex === VECTOR) {
    readerPropDef.vectorBaseType = p.vectorBaseType
  }
  return readerPropDef
}

export const convertToReaderSchema = (q: QueryDef): ReaderSchema => {
  const t = q.type
  const isRoot = t === QueryDefType.Root
  const isSingle = isRoot && ('id' in q.target || 'alias' in q.target)
  const isEdge = t === QueryDefType.Edge

  const readerSchema: ReaderSchema = {
    props: {},
    main: { len: 0, props: {} },
    refs: {},
    type: isEdge
      ? ReaderSchemaEnum.edge
      : isSingle
        ? q.target.type === '_root'
          ? ReaderSchemaEnum.rootProps
          : ReaderSchemaEnum.single
        : ReaderSchemaEnum.default,
  }

  if (isRoot && q.search) {
    readerSchema.hasSearch = true
  }

  console.log(q.include)
  for (const [k, v] of q.include.props) {
    readerSchema.props[k] = createReaderPropDef(v.def, v.opts)
  }

  readerSchema.main.len = q.include.main.len
  for (const k in q.include.main.include) {
    const [start, p, opts] = q.include.main.include[k]
    readerSchema.main.props[start] = createReaderPropDef(p, opts)
  }

  for (const [k, v] of q.references.entries()) {
    const target = v.target as Target
    const propDef = target.propDef
    readerSchema.refs[k] = {
      schema: convertToReaderSchema(v),
      prop: {
        path: propDef.path,
        typeIndex: propDef.typeIndex,
      },
    }
  }

  if (q.edges) {
    readerSchema.edges = convertToReaderSchema(q.edges)
  }

  return readerSchema
}
