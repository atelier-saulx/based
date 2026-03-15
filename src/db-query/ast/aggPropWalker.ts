import { TypeDef, PropDef } from '../../schema/defs/index.js'
import {
  AggFunction,
  AggFunctionEnum,
  createAggProp,
  AggPropByteSize,
  PropType,
} from '../../zigTsExports.js'
import { Ctx, QueryAst } from './ast.js'
import { readPropDef } from './readSchema.js'
import { SizesType, isAggregateAst } from './aggregates.js'

const enum AccumulatorSize {
  // comptime
  sum = 8,
  count = 4,
  cardinality = 4,
  stddev = 24, // count (u64) + sum (f64) + sum_sq (f64) = 8 + 8 + 8 = 24
  avg = 16, // count (u64) + sum (f64) = 16
  variance = 24, // count (u64) + sum (f64) + sum_sq (f64) = 8 + 8 + 8 = 24
  max = 8,
  min = 8,
  hmean = 16,
}

const aggregateTypeMap = new Map<
  AggFunctionEnum,
  { resultsSize: number; accumulatorSize: number }
>([
  [
    AggFunction.cardinality,
    { resultsSize: 4, accumulatorSize: AccumulatorSize.cardinality },
  ],
  [
    AggFunction.count,
    { resultsSize: 4, accumulatorSize: AccumulatorSize.count },
  ],
  [
    AggFunction.stddev,
    { resultsSize: 8, accumulatorSize: AccumulatorSize.stddev },
  ],
  [AggFunction.avg, { resultsSize: 8, accumulatorSize: AccumulatorSize.avg }],
  [
    AggFunction.hmean,
    { resultsSize: 8, accumulatorSize: AccumulatorSize.hmean },
  ],
  [
    AggFunction.variance,
    { resultsSize: 8, accumulatorSize: AccumulatorSize.variance },
  ],
  // Othe types like MAX, MIN, SUM fall in the else case in aggregation.ts 8/8
])

export const resolveProp = (
  typeDef: TypeDef,
  propFullName: string,
  asReference?: PropDef,
  isCount?: boolean,
): { isEdge: boolean; propDef: PropDef; edgePropId?: number } => {
  let propDef: PropDef | any = typeDef.props.get(propFullName)
  let isEdge = false
  let edgePropId: number | undefined

  if (!propDef && asReference?.edges) {
    let edgePropName = propFullName
    const refPathPrefix = asReference.path
      ? asReference.path.join('.') + '.'
      : ''
    if (refPathPrefix && edgePropName.startsWith(refPathPrefix)) {
      edgePropName = edgePropName.slice(refPathPrefix.length)
    } else if (edgePropName.startsWith('$')) {
      edgePropName = edgePropName
    }

    propDef = asReference.edges.props.get(edgePropName)
    if (propDef) {
      isEdge = true
      edgePropId = asReference.id
    }
  } else if (!propDef && propFullName.includes('.')) {
    const parts = propFullName.split('.')
    const edgePropName = parts.pop()!
    const parentPath = parts.join('.')
    const parentPropDef: any = typeDef.props.get(parentPath)
    if (parentPropDef && parentPropDef.edges) {
      propDef = parentPropDef.edges.props.get(edgePropName)
      if (propDef) {
        isEdge = true
        edgePropId = parentPropDef.id
      }
    }
  }

  if (isCount) {
    propDef = {
      id: 255,
      path: ['count'],
      start: 0,
      type: 1,
    }
  }

  if (!propDef) {
    throw new Error(`Property '${propFullName}' not found`)
  }

  return { isEdge, propDef, edgePropId }
}

export const walkProp = (
  ctx: Ctx,
  sizes: SizesType,
  typeDef: TypeDef,
  propFullName: string,
  fn: AggFunctionEnum,
  asReference?: PropDef,
  isCount?: boolean,
): { isEdge: boolean; propDef: PropDef; edgePropId?: number } => {
  const { isEdge, propDef, edgePropId } = resolveProp(
    typeDef,
    propFullName,
    asReference,
    isCount,
  )

  let resSize = 0
  let accSize = 0
  const specificSizes = aggregateTypeMap.get(fn)
  if (specificSizes) {
    resSize += specificSizes.resultsSize
    accSize += specificSizes.accumulatorSize
  } else {
    resSize += 8
    accSize += 8
  }

  const buffer = createAggProp({
    propId: propDef.id,
    propType: propDef.type || 0,
    propDefStart: propDef.start || 0,
    aggFunction: fn,
    resultPos: sizes.result,
    accumulatorPos: sizes.accumulator,
    isEdge,
  })

  ctx.readSchema.aggregate?.aggregates.push({
    path: propDef.path!,
    type: fn,
    resultPos: sizes.result,
  })

  ctx.query.data.set(buffer, ctx.query.length)
  ctx.query.length += AggPropByteSize

  sizes.result += resSize
  sizes.accumulator += accSize

  ctx.readSchema.aggregate!.totalResultsSize += resSize

  return { isEdge, propDef, edgePropId }
}

export const walkProps = (
  ctx: Ctx,
  sizes: SizesType,
  typeDef: TypeDef,
  targetAst: QueryAst,
  currentPath: string[],
  asReference?: PropDef,
): { hasEdges: boolean; edgePropId?: number } => {
  let hasEdges = false
  let defaultEdgePropId: number | undefined
  let i = 0

  for (const key in AggFunction) {
    if (!(key in targetAst)) continue

    const data = targetAst[key]
    if (!data) continue

    const fn = AggFunction[key]

    let props = Array.isArray(data.props)
      ? data.props
      : data.props
        ? [data.props]
        : []

    if (key === 'count' && props.length === 0) {
      ctx.readSchema.aggregate?.aggregates.push({
        path: ['count'],
        type: fn,
        resultPos: sizes.result,
      })
      props.push('count')
    }

    for (const propName of props) {
      const fullParts = [...currentPath]
      const isCount = propName === 'count' && fn === AggFunction.count
      if (!isCount) {
        fullParts.push(propName)
      }
      const fullPropName = fullParts.join('.')

      const { isEdge, propDef, edgePropId } = walkProp(
        ctx,
        sizes,
        typeDef,
        fullPropName,
        fn,
        asReference,
        isCount,
      )
      if (isEdge) {
        hasEdges = true
        if (edgePropId) defaultEdgePropId = edgePropId
      }
      ctx.readSchema.main.props[i] = readPropDef(propDef, ctx)
      ctx.readSchema.main.len += propDef.size
      i += propDef.size
    }
  }

  if (targetAst.props) {
    for (const key in targetAst.props) {
      const childPath = [...currentPath, key].join('.')
      const childPropDef = typeDef.props.get(childPath)

      if (
        isAggregateAst(targetAst.props[key], typeDef, [...currentPath, key])
      ) {
        const result = walkProps(
          ctx,
          sizes,
          typeDef,
          targetAst.props[key],
          [...currentPath, key],
          asReference,
        )
        if (result.hasEdges) {
          hasEdges = true
          if (result.edgePropId) defaultEdgePropId = result.edgePropId
        }
      }
    }
  }

  if (targetAst.edges) {
    for (const key in targetAst.edges) {
      const childPath = [...currentPath, key].join('.')
      const childPropDef = asReference?.edges?.props.get(childPath)

      if (
        childPropDef &&
        (childPropDef.type === PropType.reference ||
          childPropDef.type === PropType.references ||
          childPropDef.isEdge)
      ) {
        continue
      }

      if (
        isAggregateAst(targetAst.edges[key], typeDef, [...currentPath, key])
      ) {
        const result = walkProps(
          ctx,
          sizes,
          typeDef,
          targetAst.edges[key],
          [...currentPath, key],
          asReference,
        )
        if (result.hasEdges) {
          hasEdges = true
          if (result.edgePropId) defaultEdgePropId = result.edgePropId
        }
      }
    }
  }

  return { hasEdges, edgePropId: defaultEdgePropId }
}
