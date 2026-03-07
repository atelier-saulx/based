import { PropType, PropTypeSelva, pushSelvaSchemaAlias, writeSelvaSchemaAliasProps } from '../../../zigTsExports.js'
import type { AutoSizedUint8Array } from '../../../utils/AutoSizedUint8Array.js'
import { BasePropDef } from './base.js'
import { SchemaAlias } from '../../schema/alias.js'

export const alias = class Alias extends BasePropDef {
  override type = PropType.alias
  declare schema: SchemaAlias
  override pushValue(
    buf: AutoSizedUint8Array,
    value: unknown,
  ): asserts value is string {
    if (typeof value !== 'string') {
      throw new Error('Invalid type for alias ' + this.path.join('.'))
    }
    if (!value.trim()) {
      throw new Error('Invalid alias ' + this.path.join('.'))
    }
    buf.pushString(value)
  }
  override pushSelvaSchema(buf: AutoSizedUint8Array) {
    pushSelvaSchemaAlias(buf, {
      type: PropTypeSelva.alias,
    })
  }
}
