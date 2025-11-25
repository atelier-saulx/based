import { DbClient } from '../../index.js'
import { IntermediateByteCode, QueryDef, QueryDefType } from '../types.js'
import { walkDefs } from './walk.js'
import { langCodesMap } from '@based/schema'
import { writeUint16, writeUint32 } from '@based/utils'
import { getEnd } from './utils.js'
import {
  PropType,
  writeIncludeHeader,
  IncludeOp,
  writeIncludeOptsHeader,
  createIncludeHeader,
  createIncludeOptsHeader,
  LangCode,
} from '../../../zigTsExports.js'

const EMPTY_BUFFER = new Uint8Array(0)

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
    for (const [prop, propDef] of def.include.props.entries()) {
      const propType = propDef.opts?.raw
        ? PropType.binary
        : propDef.def.typeIndex // replace this with proptype
      if (propDef.opts?.meta) {
        if (propDef.opts.codes) {
          if (propDef.opts.codes.has(0)) {
            for (const code in def.schema!.locales) {
              // const buf = new Uint8Array(4)
              // writeIncludeHeader(
              //   buf,
              //   {
              //     op: IncludeOp.meta,
              //     prop,
              //     propType: propType,
              //   },
              //   0,
              // )
              // buf[3] = langCodesMap.get(code)
              // result.push(buf)
            }
          } else {
            for (const code of propDef.opts.codes) {
              // const buf = new Uint8Array(4)
              // writeIncludeHeader(
              //   buf,
              //   {
              //     op: IncludeOp.meta,
              //     prop,
              //     propType: propType,
              //   },
              //   0,
              // )
              // buf[3] = code
              // result.push(buf)
            }
          }
        } else {
          const buf = new Uint8Array(4)
          // writeIncludeHeader(
          //   buf,
          //   {
          //     op: IncludeOp.meta,
          //     prop,
          //     propType: propType,
          //   },
          //   0,
          // )
          buf[3] = 0
          result.push(buf)
        }
      }

      if (propDef.opts?.meta !== 'only') {
        const hasEndOption = !!propDef.opts?.end
        const codes = propDef.opts!?.codes!

        if (propType === PropType.text && !codes?.has(0)) {
          for (const code of codes) {
            const fallBackSize = propDef.opts!.fallBacks!.length

            if (fallBackSize) {
              console.log('derp', fallBackSize)
            }

            // const endCode = getEnd(propDef.opts, code)
            // const b = new Uint8Array(7 + (endCode ? 5 : 0) + fallBackSize)
            // writeIncludeHeader(
            //   b,
            //   {
            //     op: IncludeOp.default,
            //     prop,
            //     propType: propType,
            //   },
            //   0,
            // )
            // let i = 0
            // if (endCode) {
            //   b[3] = fallBackSize + 8 // opts
            //   b[4] = code // say if there is a end option
            //   b[5] = fallBackSize
            //   b[6] = 1 // has end
            //   b[7] = propDef.opts?.bytes ? 0 : 1 // is string use chars (can be optional)
            //   writeUint32(b, endCode, 8)
            //   i = 11
            // } else {
            //   b[3] = fallBackSize + 3 // opts
            //   b[4] = code // say if there is a end option
            //   b[5] = fallBackSize
            //   b[6] = 0 // no end
            //   i = 7
            // }
            // for (const fallback of propDef.opts.fallBacks) {
            //   b[i] = fallback
            //   i++
            // }
            // result.push(b)
          }
        } else if (hasEndOption) {
          const isChars =
            propDef.opts?.bytes ||
            (propType !== PropType.json && propType !== PropType.string)
              ? false
              : true
          result.push(
            createIncludeHeader({
              op: IncludeOp.defaultWithOpts,
              prop,
              propType: propType,
            }),
            createIncludeOptsHeader({
              isChars,
              end: getEnd(propDef.opts),
              lang: LangCode.NONE,
              hasLangFallback: false,
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
