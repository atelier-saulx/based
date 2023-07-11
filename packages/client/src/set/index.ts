import { BasedSchemaCollectProps } from '@based/schema'
import { ModifyArgType } from '../protocol/encode/modify/types'

const DB_TYPE_TO_MODIFY_TYPE = {
  string: ModifyArgType.SELVA_MODIFY_ARG_STRING,
  number: ModifyArgType.SELVA_MODIFY_ARG_DEFAULT_DOUBLE,
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
