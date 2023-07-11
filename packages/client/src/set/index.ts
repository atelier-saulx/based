import { BasedSchemaCollectProps } from '@based/schema'
import { ModifyArgType } from '../protocol/encode/modify/types'

const DB_TYPE_TO_MODIFY_TYPE = {
  string: ModifyArgType.SELVA_MODIFY_ARG_STRING,
  integer: ModifyArgType.SELVA_MODIFY_ARG_LONGLONG,
  boolean: ModifyArgType.SELVA_MODIFY_ARG_LONGLONG,
  float: ModifyArgType.SELVA_MODIFY_ARG_DOUBLE,
  number: ModifyArgType.SELVA_MODIFY_ARG_DOUBLE,
}

const VALUE_TYPE_TO_DEFAULT_VALUE_TYPE = {
  3: '8',
  A: '9',
  0: '2',
}

export function toModifyArgs(props: BasedSchemaCollectProps): any[] {
  const { fieldSchema, path, value } = props
  // @ts-ignore
  const opType = DB_TYPE_TO_MODIFY_TYPE[fieldSchema.type]
  if (!opType) {
    console.error('Unsupported field type', path, fieldSchema, value)
    return []
  }

  return [opType, path.join('.'), value]
}
