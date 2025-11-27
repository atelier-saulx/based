import { DbClient } from '../../index.js'
import {
  IncludeField,
  IncludeOpts,
  IntermediateByteCode,
  QueryDef,
  QueryDefType,
} from '../types.js'
import { walkDefs } from './walk.js'
import { writeUint16 } from '../../../utils/index.js'
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
    const len =
      def.type === QueryDefType.Edge
        ? def.target.ref!.edgeMainLen
        : def.schema!.mainLen

    if (def.include.main.len === len) {
      // Get all main fields
      mainBuffer = EMPTY_BUFFER
      for (const value of def.include.main.include.values()) {
        value[0] = value[1].start
        console.log(value)
      }
    } else {
      const size = def.include.main.include.size
      mainBuffer = new Uint8Array(size * 4 + 2)
      writeUint16(mainBuffer, def.include.main.len, 0)
      let i = 2
      let m = 0
      for (const value of def.include.main.include.values()) {
        const propDef = value[1]
        writeUint16(mainBuffer, propDef.start, i)
        writeUint16(mainBuffer, propDef.len, i + 2)
        value[0] = m
        i += 4
        m += propDef.len
      }
    }
  }

  const propSize = def.include.props.size ?? 0

  if (def.include.main.len > 0) {
    if (isPartialMain(def)) {
      // result.push(
      //   createIncludePartialHeader({
      //     op: IncludeOp.partial,
      //     prop: MAIN_PROP,
      //     propType: PropType.microBuffer,
      //     size: mainBuffer.byteLength,
      //   }),
      //   mainBuffer,
      // )
    } else {
      console.log('GET ALL')
      result.push(
        createIncludeHeader({
          op: IncludeOp.default,
          prop: MAIN_PROP,
          propType: PropType.microBuffer,
        }),
      )
    }
  }

  if (propSize) {
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
