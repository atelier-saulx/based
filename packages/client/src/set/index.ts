import { BasedSchemaCollectProps } from '@based/schema'
import { ModifyArgType, ModifyOpSetType } from '../protocol/encode/modify/types'

const DB_TYPE_TO_MODIFY_TYPE = {
  string: ModifyArgType.SELVA_MODIFY_ARG_STRING,
  integer: ModifyArgType.SELVA_MODIFY_ARG_LONGLONG,
  boolean: ModifyArgType.SELVA_MODIFY_ARG_LONGLONG,
  timestamp: ModifyArgType.SELVA_MODIFY_ARG_LONGLONG,
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
  const strPath = path.join('.')

  if (fieldSchema.type === 'references') {
    return [
      ModifyArgType.SELVA_MODIFY_ARG_OP_SET,
      strPath,
      { ...value, setType: ModifyOpSetType.SELVA_MODIFY_OP_SET_TYPE_REFERENCE },
    ]
  }

  const opType = DB_TYPE_TO_MODIFY_TYPE[fieldSchema.type]

  if (!opType) {
    console.error('Unsupported field type', path, fieldSchema, value)
    return []
  }

  return [opType, strPath, value]
}
