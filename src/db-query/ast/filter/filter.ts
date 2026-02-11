import {
  isPropDef,
  PropDef,
  PropTree,
  TypeDef,
} from '../../../schema/defs/index.js'
import { debugBuffer } from '../../../sdk.js'
import { concatUint8Arr, writeUint64 } from '../../../utils/uint8.js'
import {
  FilterConditionAlignOf,
  FilterOpCompare,
  ID_PROP,
  PropType,
  writeFilterConditionProps,
} from '../../../zigTsExports.js'
import { Ctx, FilterAst, FilterOp } from '../ast.js'
import {
  conditionBuffer,
  conditionByteSize,
  createCondition,
} from './condition.js'

type WalkCtx = {
  tree: PropTree
  prop: number
  main: { prop: PropDef; ops: FilterOp[] }[]
}

const walk = (ast: FilterAst, ctx: Ctx, typeDef: TypeDef, walkCtx: WalkCtx) => {
  const { tree, main } = walkCtx

  for (const field in ast.props) {
    const prop = tree.get(field)
    const astProp = ast.props[field]
    const ops = astProp.ops

    // AND & OR
    if (isPropDef(prop)) {
      if (prop.type === PropType.references) {
        // references(astProp, ctx, prop)
      } else if (prop.type === PropType.reference) {
        // this can be added here
        // reference(astProp, ctx, prop)
      } else if (ops) {
        if (prop.id === 0) {
          main.push({ prop, ops })
        } else {
          walkCtx.prop = prop.id
          for (const op of ops) {
            // can prob just push this directly
            const condition = createCondition(prop, op.op, op.val, op.opts)
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

const MAX_U64 = 213123211231221 - 1e9

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

  // need to pass the prop

  // or cond needs to be here

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
    // better to do main first scince they are usualy lighter filters...
    walkCtx.prop = prop.id
    for (const op of ops) {
      const condition = createCondition(prop, op.op, op.val, op.opts)
      ctx.query.set(condition, ctx.query.length)
    }
  }

  if (ast.and) {
    console.log('========AND========', startIndex)
    console.dir(ast.and, { depth: 10 })
    // reserve OR
    // if (ast.or) {
    //   ctx.query.reserve(conditionByteSize(8, 8))
    // }
    // maybe just add .AND command

    if (ast.or) {
      const { offset, condition } = conditionBuffer(
        {
          id: 67,
          // PropType.id,
          size: 8,
          start: 0,
        },
        8,
        { compare: FilterOpCompare.nextOrIndex, prop: PropType.null },
      )
      console.log(condition)
      writeUint64(condition, MAX_U64 + Math.floor(Math.random() * 1e9), offset)
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

    const { offset, condition } = conditionBuffer(
      { id: lastProp, size: 8, start: 0 },
      8,
      { compare: FilterOpCompare.nextOrIndex, prop: PropType.null },
    )

    console.info('NEXT OR INDEX', nextOrIndex)
    console.log('========OR========')
    console.dir(ast.or, { depth: 10 })
    writeUint64(condition, nextOrIndex, offset)
    ctx.query.set(condition, startIndex)
    // then add the actual OR cond

    // if FROM OR
    //
    //  if (ast.or) {
    // ctx.query.reserve(conditionByteSize(8, 8))
    // }

    if (prevOr) {
      console.log('========== PREV OR ==========')
      ctx.query.set(prevOr, ctx.query.length)
    }

    if (andOrReplace) {
      console.log('========== PREV OR REPLACE ==========')
      console.log(andOrReplace)
      let index = indexOf(
        ctx.query.data,
        andOrReplace,
        startIndex,
        ctx.query.length,
      )
      if (index === -1) {
        console.log('derp', index)
      } else {
        writeUint64(ctx.query.data, nextOrIndex, offset + index)

        // console.log('derp', index)

        // console.log('----------->', index + offset - 8, offset)

        writeFilterConditionProps.prop(
          ctx.query.data,
          walkCtx.prop,
          index + FilterConditionAlignOf + 1,
        )
      }
    }

    filter(
      ast.or,
      ctx,
      typeDef,
      ctx.query.length - startIndex + filterIndex,
      walkCtx.prop,
    )
  }

  // console.log('-------------------------DERP FILTER...')
  // debugBuffer(ctx.query.data, startIndex, ctx.query.length)
  // console.log('-------------------------DERP FILTER... DONE')

  return ctx.query.length - startIndex
}
