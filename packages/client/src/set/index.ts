import { BasedSchemaCollectProps, BasedSchemaFieldSet } from '@based/schema'
import { ModifyArgType, ModifyOpSetType } from '../protocol/encode/modify/types'
import { arrayOpToModify } from './array'
import { joinPath } from '../util'

const DB_TYPE_TO_MODIFY_TYPE = {
  string: ModifyArgType.SELVA_MODIFY_ARG_STRING,
  integer: ModifyArgType.SELVA_MODIFY_ARG_LONGLONG,
  boolean: ModifyArgType.SELVA_MODIFY_ARG_LONGLONG,
  timestamp: ModifyArgType.SELVA_MODIFY_ARG_LONGLONG,
  float: ModifyArgType.SELVA_MODIFY_ARG_DOUBLE,
  number: ModifyArgType.SELVA_MODIFY_ARG_DOUBLE,
  cardinality: ModifyArgType.SELVA_MODIFY_ARG_OP_HLL,
}

const DB_TYPE_TO_SET_TYPE = {
  references: ModifyOpSetType.SELVA_MODIFY_OP_SET_TYPE_REFERENCE,
  string: ModifyOpSetType.SELVA_MODIFY_OP_SET_TYPE_CHAR,
  integer: ModifyOpSetType.SELVA_MODIFY_OP_SET_TYPE_LONG_LONG,
  double: ModifyOpSetType.SELVA_MODIFY_OP_SET_TYPE_DOUBLE,
}

const VALUE_TYPE_TO_DEFAULT_VALUE_TYPE = {
  3: '8',
  A: '9',
  0: '2',
}

export function toModifyArgs(props: BasedSchemaCollectProps): any[] {
  const { fieldSchema, path, value } = props
  const strPath = joinPath(path)

  switch (fieldSchema.type) {
    case 'reference':
    case 'references':
      return [
        ModifyArgType.SELVA_MODIFY_ARG_OP_SET,
        strPath,
        {
          ...value,
          setType: ModifyOpSetType.SELVA_MODIFY_OP_SET_TYPE_REFERENCE,
          isSingle: fieldSchema.type === 'reference' ? true : false,
        },
      ]
    case 'set':
      const setFieldSchema = <BasedSchemaFieldSet>fieldSchema
      return [
        ModifyArgType.SELVA_MODIFY_ARG_OP_SET,
        strPath,
        { ...value, setType: DB_TYPE_TO_SET_TYPE[setFieldSchema.items.type] },
      ]
    case 'array':
      // we are doing an array level operation like $push etc.
      // array operations can yield to multiple modify args
      // so encoding happens here instead of at modify encoding level
      return arrayOpToModify(props)
    case 'object':
      return [ModifyArgType.SELVA_MODIFY_ARG_OP_OBJ_META, strPath, [0]]
    case 'record':
      return [ModifyArgType.SELVA_MODIFY_ARG_OP_OBJ_META, strPath, [1]]
    case 'text':
      return [ModifyArgType.SELVA_MODIFY_ARG_OP_OBJ_META, strPath, [2]]
    default:
      const opType = DB_TYPE_TO_MODIFY_TYPE[fieldSchema.type]

      if (!opType) {
        console.error('Unsupported field type', path, fieldSchema, value)
        return []
      }

      return [opType, strPath, value]
  }
}
