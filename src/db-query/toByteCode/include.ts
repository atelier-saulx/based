import { PropDef } from '../../schema/defs/index.js'
import { AutoSizedUint8Array } from '../../utils/AutoSizedUint8Array.js'
import { IncludeOp, pushIncludeHeader } from '../../zigTsExports.js'

export const includeProp = (buf: AutoSizedUint8Array, propDef: PropDef) => {
  // derp
  pushIncludeHeader(buf, {
    op: IncludeOp.default,
    prop: propDef.id,
    propType: propDef.type,
  })
}

export const includeProps = (buf: AutoSizedUint8Array, propDef: PropDef[]) => {
  // sort all main on start
}
