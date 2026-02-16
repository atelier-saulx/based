import {
  isPropDef,
  PropDef,
  PropTree,
  TypeDef,
} from '../../../schema/defs/index.js'
import { writeUint64 } from '../../../utils/uint8.js'
import {
  FilterConditionAlignOf,
  FilterOpCompare,
  PropType,
  writeFilterConditionProps,
} from '../../../zigTsExports.js'
import { Ctx, FilterAst, FilterOp } from '../ast.js'
import { comparison, conditionByteSize, createCondition } from './comparison.js'

type WalkCtx = {
  tree: PropTree
  prop: number
  main: { prop: PropDef; ops: FilterOp[] }[]
}

// Handle EDGES

const walk = (ast: FilterAst, ctx: Ctx, typeDef: TypeDef, walkCtx: WalkCtx) => {
  const { tree, main } = walkCtx

  for (const field in ast.props) {
    const prop = tree.props.get(field)
    const astProp = ast.props[field]
    const ops = astProp.ops
    if (isPropDef(prop)) {
      if (prop.type === PropType.references) {
        // references(astProp, ctx, prop)
      } else if (prop.type === PropType.reference) {
        // this can be added here
        // need this again...
        // reference(astProp, ctx, prop)
      } else if (ops) {
        if (prop.id === 0) {
          main.push({ prop, ops })
        } else {
          walkCtx.prop = prop.id
          for (const op of ops) {
            // can prob just push this directly
            const condition = comparison(prop, op.op, op.val, op.opts)
            ctx.query.set(condition, ctx.query.length)
          }
        }
      }
    } else {
      if (prop) {
        walk(astProp, ctx, typeDef, {
          main,
          tree: prop,
          prop: walkCtx.prop,
        })
      } else {
        // if EN, if NL
        throw new Error(`Prop does not exist ${field}`)
      }
    }
  }
  return walkCtx
}

const MAX_INDEX = 11e9 - 1e9

const indexOf = (
  haystack: Uint8Array,
  needle: Uint8Array,
  offset: number,
  end: number,
) => {
  if (needle.length === 0) return 0
  for (let i = offset; i <= end - needle.length; i++) {
    let found = true
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) {
        found = false
        break
      }
    }
    if (found) return i
  }
  return -1
}

export const filter = (
  ast: FilterAst,
  ctx: Ctx,
  typeDef: TypeDef,
  filterIndex: number = 0,
  lastProp: number = PropType.id,
  prevOr?: Uint8Array,
): number => {
  const startIndex = ctx.query.length

  const walkCtx = {
    main: [],
    tree: typeDef.tree,
    prop: lastProp,
  }

  if (ast.or) {
    ctx.query.reserve(conditionByteSize(8, 8))
  }

  let andOrReplace: Uint8Array | void = undefined

  const { main } = walk(ast, ctx, typeDef, walkCtx)

  for (const { prop, ops } of main) {
    walkCtx.prop = prop.id
    for (const op of ops) {
      const condition = comparison(prop, op.op, op.val, op.opts)
      ctx.query.set(condition, ctx.query.length)
    }
  }

  if (ast.and) {
    if (ast.or) {
      const { offset, condition } = createCondition(
        {
          id: PropType.id,
          size: 8,
          start: 0,
          type: PropType.null,
        },
        FilterOpCompare.nextOrIndex,
      )
      writeUint64(
        condition,
        MAX_INDEX + Math.floor(Math.random() * 1e9),
        offset,
      )
      andOrReplace = condition
      filter(
        ast.and,
        ctx,
        typeDef,
        ctx.query.length - startIndex,
        walkCtx.prop,
        andOrReplace,
      )
    } else {
      filter(ast.and, ctx, typeDef, ctx.query.length - startIndex, walkCtx.prop)
    }
  }

  if (ast.or) {
    const resultSize = ctx.query.length - startIndex
    const nextOrIndex = resultSize + filterIndex

    const { offset, condition } = createCondition(
      { id: lastProp, size: 8, start: 0, type: PropType.null },
      FilterOpCompare.nextOrIndex,
    )

    writeUint64(condition, nextOrIndex, offset)
    ctx.query.set(condition, startIndex)

    if (prevOr) {
      if (ast.or.or) {
      } else {
        ctx.query.set(prevOr, ctx.query.length)
        prevOr = undefined
      }
    }

    if (andOrReplace) {
      // REMOVE THIS! FIX
      let index = indexOf(
        ctx.query.data,
        andOrReplace,
        startIndex,
        ctx.query.length,
      )
      if (index === -1) {
        throw new Error('Cannot find AND OR REPLACE INDEX')
      }
      writeUint64(ctx.query.data, nextOrIndex, offset + index)
      writeFilterConditionProps.prop(
        ctx.query.data,
        walkCtx.prop,
        index + FilterConditionAlignOf + 1,
      )
    }
    filter(
      ast.or,
      ctx,
      typeDef,
      ctx.query.length - startIndex + filterIndex,
      walkCtx.prop,
      prevOr,
    )
  }

  return ctx.query.length - startIndex
}
