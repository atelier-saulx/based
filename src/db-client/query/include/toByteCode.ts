import { DbClient } from '../../index.js'
import {
  IncludeOpts,
  IntermediateByteCode,
  QueryDef,
  QueryDefType,
} from '../types.js'
import { walkDefs } from './walk.js'
import { getEnd } from './utils.js'
import {
  PropType,
  IncludeOp,
  createIncludeHeader,
  createIncludeOpts,
  LangCode,
  createIncludeMetaHeader,
  MAIN_PROP,
  createIncludePartialHeader,
  writeIncludePartialProp,
} from '../../../zigTsExports.js'

const EMPTY_BUFFER = new Uint8Array(0)

const isPartialMain = (def: QueryDef) => {
  return (
    def.include.main.len !==
    (def.type === QueryDefType.Edge
      ? def.target.ref!.edgeMainLen
      : def.schema!.mainLen)
  )
}

export const createLangFallbacks = (opts: IncludeOpts) => {
  const langFallbacks = new Uint8Array(opts.fallBacks!.length || 0)
  for (let i = 0; i < opts.fallBacks!.length || 0; i++) {
    langFallbacks[i] = opts.fallBacks![i]
  }
  return langFallbacks
}

export const includeToBuffer = (
  db: DbClient,
  def: QueryDef,
): IntermediateByteCode[] => {
  const result: Uint8Array[] = []

  if (
    !def.include.stringFields.size &&
    !def.include.props.size &&
    !def.references.size &&
    !def.include.main.len
  ) {
    return result
  }

  let mainBuffer: Uint8Array

  if (def.include.stringFields) {
    for (const [field, include] of def.include.stringFields.entries()) {
      walkDefs(db, def, { field, opts: include.opts })
    }
  }

  if (def.include.main.len > 0) {
    if (isPartialMain(def)) {
      const size = def.include.main.include.size
      mainBuffer = new Uint8Array(size * 4)
      let i = 0
      let m = 0
      for (const value of def.include.main.include.values()) {
        const propDef = value[1]
        writeIncludePartialProp(
          mainBuffer,
          {
            start: propDef.start,
            size: propDef.len,
          },
          i,
        )
        // This writes the actual address of the prop to be used on read
        value[0] = m
        i += 4
        m += propDef.len
      }
      result.push(
        createIncludePartialHeader({
          op: IncludeOp.partial,
          prop: MAIN_PROP,
          propType: PropType.microBuffer,
          amount: size,
        }),
        mainBuffer,
      )
    } else {
      for (const [start, value] of def.include.main.include.entries()) {
        value[0] = start
      }
      result.push(
        createIncludeHeader({
          op: IncludeOp.default,
          prop: MAIN_PROP,
          propType: PropType.microBuffer,
        }),
      )
    }
  }

  if (def.include.props.size > 0) {
    // make this a function (the nested)
    for (const [prop, propDef] of def.include.props.entries()) {
      const opts = propDef.opts
      const propType = propDef.opts?.raw
        ? PropType.binary
        : propDef.def.typeIndex

      if (opts?.meta) {
        const codes = opts?.codes
        if (codes && !codes.has(0)) {
          const fallBacks = createLangFallbacks(opts)
          let i = 0
          for (const code of codes) {
            i++
            result.push(
              createIncludeMetaHeader({
                op: IncludeOp.metaWithOpts,
                prop,
                propType: propType,
              }),
              createIncludeOpts({
                hasOpts: i !== codes.size,
                end: getEnd(propDef.opts),
                isChars: !propDef.opts?.bytes,
                lang: code,
                langFallbackSize: fallBacks.byteLength,
              }),
              fallBacks,
            )
          }
        } else {
          result.push(
            createIncludeMetaHeader({
              op: IncludeOp.meta,
              prop,
              propType: propType,
            }),
          )
        }
      }

      if (opts?.meta !== 'only') {
        const hasEndOption = !!opts?.end
        const codes = opts?.codes
        if (codes && !codes.has(0)) {
          const fallBacks = createLangFallbacks(opts)
          result.push(
            createIncludeHeader({
              op: IncludeOp.defaultWithOpts,
              prop,
              propType: propType,
            }),
          )
          let i = 0
          for (const code of codes) {
            i++
            result.push(
              createIncludeOpts({
                hasOpts: i !== codes.size,
                end: getEnd(propDef.opts),
                isChars: !propDef.opts?.bytes,
                lang: code,
                langFallbackSize: fallBacks.byteLength,
              }),
              fallBacks,
            )
          }
        } else if (hasEndOption) {
          result.push(
            createIncludeHeader({
              op: IncludeOp.defaultWithOpts,
              prop,
              propType: propType,
            }),
            createIncludeOpts({
              hasOpts: false,
              end: getEnd(propDef.opts),
              isChars:
                !propDef.opts?.bytes &&
                (propType === PropType.json ||
                  propType === PropType.string ||
                  propType === PropType.text),
              lang: LangCode.none,
              langFallbackSize: 0,
            }),
          )
        } else {
          result.push(
            createIncludeHeader({
              op: IncludeOp.default,
              prop,
              propType: propType,
            }),
          )
        }
      }
    }
  }

  return result
}
