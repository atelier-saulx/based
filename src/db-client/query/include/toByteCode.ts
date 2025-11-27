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
} from '../../../zigTsExports.js'

const EMPTY_BUFFER = new Uint8Array(0)

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
      let i = 2
      for (const value of def.include.main.include.values()) {
        value[0] = value[1].start
        i += 4
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

  if (mainBuffer!) {
    if (mainBuffer.byteLength !== 0) {
      const buf = new Uint8Array(5)
      // writeIncludeHeader(
      //   buf,
      //   {
      //     op: IncludeOp.partial,
      //     prop: 0,
      //     propType: PropType.microBuffer,
      //   },
      //   0,
      // )
      // add opts len here...
      writeUint16(buf, mainBuffer.byteLength, 3)
      result.push(buf, mainBuffer)
    } else {
      const buf = new Uint8Array(4)
      // writeIncludeHeader(
      //   buf,
      //   {
      //     op: IncludeOp.default,
      //     prop: 0,
      //     propType: PropType.microBuffer,
      //   },
      //   0,
      // )
      buf[3] = 0 // opts len
      result.push(buf)
    }
  }

  if (propSize) {
    // make this a function (the nested)
    for (const [prop, propDef] of def.include.props.entries()) {
      const opts = propDef.opts
      const propType = propDef.opts?.raw
        ? PropType.binary
        : propDef.def.typeIndex
      if (propDef.opts?.meta) {
        if (propDef.opts.codes) {
          const codes = propDef.opts.codes.has(0)
            ? Object.keys(def.schema!.locales).map((c) => LangCode[c])
            : propDef.opts.codes

          console.log({ codes }, def.schema!.locales)
          for (const code of codes) {
            result.push(
              createIncludeMetaHeader({
                op: IncludeOp.meta,
                prop,
                propType: propType,
                lang: code,
              }),
            )
          }
        } else {
          result.push(
            createIncludeMetaHeader({
              op: IncludeOp.meta,
              prop,
              propType: propType,
              lang: LangCode.none,
            }),
          )
        }
      }

      console.log(opts)
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
                next: i !== codes.size,
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
              next: false,
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
