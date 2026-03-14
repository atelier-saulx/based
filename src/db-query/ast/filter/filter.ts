import {
  isPropDef,
  PropDef,
  PropTree,
  TypeDef,
} from '../../../schema/defs/index.js'
import { uint32 } from '../../../schema/defs/props/fixed.js'
import { writeUint64 } from '../../../utils/uint8.js'
import {
  FilterConditionAlignOf,
  FilterOpCompare,
  PropType,
  writeFilterConditionProps,
  LangCode,
  FilterType,
} from '../../../zigTsExports.js'
import { Ctx, FilterAst, FilterOp } from '../ast.js'
import { comparison } from './comparison.js'
import { conditionByteSize, createCondition } from './condition.js'

type WalkCtx = {
  tree: PropTree
  prop: number
  main: { prop: PropDef; ops: FilterOp[] }[]
}

// TODO tmp
const makeIdProp = (typeDef: TypeDef): PropDef => {
  const prop = new uint32({ type: 'uint32' }, ['id'], typeDef)
  prop.type = PropType.id
  prop.id = 255
  return prop
}
const walkMain = (
  ast: FilterAst,
  ctx: Ctx,
  typeDef: TypeDef,
  walkCtx: WalkCtx,
) => {
  const { tree, main } = walkCtx
  for (const field in ast.props) {
    const prop =
      field === 'id'
        ? makeIdProp(typeDef) // TODO super ineffienct might just want to add it on schema
        : tree.props.get(field)
    const astProp = ast.props[field]
    const ops = astProp.ops
    if (isPropDef(prop)) {
      if (ops && prop.id === 0) {
        main.push({ prop, ops })
      }
    } else {
      if (prop) {
        walk(astProp, ctx, typeDef, {
          main,
          tree: prop,
          prop: walkCtx.prop,
        })
      } else {
        throw new Error(`Prop does not exist ${field}`)
      }
    }
  }
  return walkCtx
}

const walk = (ast: FilterAst, ctx: Ctx, typeDef: TypeDef, walkCtx: WalkCtx) => {
  const { tree } = walkCtx
  for (const field in ast.props) {
    const prop =
      field === 'id'
        ? makeIdProp(typeDef) // TODO super ineffienct might just want to add it on schema
        : tree.props.get(field)

    const astProp = ast.props[field]
    const ops = astProp.ops
    if (isPropDef(prop)) {
      if (
        (prop.type === PropType.jsonLocalized ||
          prop.type === PropType.stringLocalized) &&
        astProp.props
      ) {
        for (const lang in astProp.props) {
          const code = LangCode[lang]
          if (!code || !ctx.locales[code]) {
            throw new Error(`Filter language not supported ${lang}`)
          }
          const ops = astProp.props[lang].ops
          if (ops) {
            for (const op of ops) {
              const condition = comparison(
                ctx,
                prop,
                walkCtx.prop,
                op.op,
                op.val,
                code,
                op.opts,
              )
              ctx.query.set(condition, ctx.query.length)
            }
          }
        }
      } else if (prop.type === PropType.references) {
        // references(astProp, ctx, prop)
        // DERP
      } else if (prop.type === PropType.reference) {
        // this can be added here
        // need this again...
        // reference(astProp, ctx, prop)
        // DERP
      } else if (ops) {
        for (const op of ops) {
          const condition = comparison(
            ctx,
            prop,
            walkCtx.prop,
            op.op,
            op.val,
            ctx.locale,
            op.opts,
          )
          ctx.query.set(condition, ctx.query.length)
        }
      }
      walkCtx.prop = prop.id
    } else {
      if (prop) {
        walk(astProp, ctx, typeDef, {
          main: [],
          tree: prop,
          prop: walkCtx.prop,
        })
      } else {
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

const filterInternal = (
  topLevelAst: FilterAst,
  ast: FilterAst,
  ctx: Ctx,
  typeDef: TypeDef,
  filterIndex: number = 0,
  lastProp: number = PropType.id,
  edgeType?: TypeDef,
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

  const { main } = walkMain(ast, ctx, typeDef, walkCtx)
  for (const { prop, ops } of main) {
    for (const op of ops) {
      const condition = comparison(
        ctx,
        prop,
        walkCtx.prop, // last prop id
        op.op,
        op.val,
        ctx.locale,
        op.opts,
      )
      ctx.query.set(condition, ctx.query.length)
    }
    walkCtx.prop = prop.id
  }

  walk(ast, ctx, typeDef, walkCtx)

  if (ast.edges) {
    topLevelAst.filterType = FilterType.edgeFilter
    if (!edgeType) {
      throw new Error('Do not have edges for filter and trying to use them')
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
      // Fixme: Can be better just pass
      writeUint64(
        condition,
        MAX_INDEX + Math.floor(Math.random() * 1e9),
        offset,
      )
      andOrReplace = condition
      filterInternal(
        topLevelAst,
        ast.and,
        ctx,
        typeDef,
        ctx.query.length - startIndex,
        walkCtx.prop,
        edgeType,
        andOrReplace,
      )
    } else {
      filterInternal(
        topLevelAst,
        ast.and,
        ctx,
        typeDef,
        ctx.query.length - startIndex,
        walkCtx.prop,
      )
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
    filterInternal(
      topLevelAst,
      ast.or,
      ctx,
      typeDef,
      ctx.query.length - startIndex + filterIndex,
      walkCtx.prop,
      edgeType,
      prevOr,
    )
  }

  return ctx.query.length - startIndex
}

export const filter = (
  ast: FilterAst,
  ctx: Ctx,
  typeDef: TypeDef,
  edgeType?: TypeDef,
  prevOr?: Uint8Array,
) => {
  // Adds a run id this makes sure filters dont get prepared more then once per poll cycle
  ctx.query.pushUint32(0)
  const len = filterInternal(
    ast,
    ast,
    ctx,
    typeDef,
    0,
    PropType.id,
    edgeType,
    prevOr,
  )
  return len + 4
}
