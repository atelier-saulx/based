import {
  BasedSchemaCollectProps,
  BasedSchemaFieldArray,
  BasedSchemaFieldSet,
} from '@based/schema'
import { ModifyArgType, ModifyOpSetType } from '../protocol/encode/modify/types'

const DB_TYPE_TO_MODIFY_TYPE = {
  string: ModifyArgType.SELVA_MODIFY_ARG_STRING,
  integer: ModifyArgType.SELVA_MODIFY_ARG_LONGLONG,
  boolean: ModifyArgType.SELVA_MODIFY_ARG_LONGLONG,
  timestamp: ModifyArgType.SELVA_MODIFY_ARG_LONGLONG,
  float: ModifyArgType.SELVA_MODIFY_ARG_DOUBLE,
  number: ModifyArgType.SELVA_MODIFY_ARG_DOUBLE,
}

const DB_TYPE_TO_SET_TYPE = {
  references: ModifyOpSetType.SELVA_MODIFY_OP_SET_TYPE_REFERENCE,
  string: ModifyOpSetType.SELVA_MODIFY_OP_SET_TYPE_CHAR,
  integer: ModifyOpSetType.SELVA_MODIFY_OP_SET_TYPE_LONG_LONG,
  double: ModifyOpSetType.SELVA_MODIFY_OP_SET_TYPE_DOUBLE,
}

const DB_TYPE_TO_ARY_TYPE = {
  string: 0,
  int: 2,
  float: 1,
  number: 1,
  object: 4,
  record: 4,
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
  } else if (fieldSchema.type === 'set') {
    const setFieldSchema = <BasedSchemaFieldSet>fieldSchema
    return [
      ModifyArgType.SELVA_MODIFY_ARG_OP_SET,
      strPath,
      { ...value, setType: DB_TYPE_TO_SET_TYPE[setFieldSchema.items.type] },
    ]
  } else if (fieldSchema.type === 'array') {
    // we are doing an array level operation like $push etc.
    const args = []
    const iPath = [...path]
    let vals = []

    const valSchema = (<BasedSchemaFieldArray>fieldSchema).values

    console.log('interesting', path, value)
    if (value.$push) {
      args.push(
        ModifyArgType.SELVA_MODIFY_ARG_OP_ARRAY_PUSH,
        strPath,
        DB_TYPE_TO_ARY_TYPE[valSchema.type]
      )

      vals = value.$push
      iPath.push(-1)
    } else if (value.$unshift) {
      args.push(
        ModifyArgType.SELVA_MODIFY_ARG_OP_ARRAY_INSERT,
        strPath,
        DB_TYPE_TO_ARY_TYPE[valSchema.type]
      )

      vals = [...value.$unshift].reverse()
      iPath.push(0)
    } else if (value.$insert) {
      args.push(
        ModifyArgType.SELVA_MODIFY_ARG_OP_ARRAY_INSERT,
        strPath,
        DB_TYPE_TO_ARY_TYPE[valSchema.type]
      )

      vals = [...value.$insert.$value].reverse()
      iPath.push(value.$insert.$idx)
    } else if (value.$assign) {
      iPath.push(value.$assign.$idx)
      vals.push(value.$assign.$value)
    } else if (value.$remove) {
      const content = new Uint32Array([value.$remove.$idx])
      const buf = Buffer.from(content.buffer)
      return [ModifyArgType.SELVA_MODIFY_ARG_OP_ARRAY_REMOVE, strPath, buf]
    }

    const vArgs = []
    for (const v of vals) {
      vArgs.push(
        ...toModifyArgs(<any>{
          fieldSchema: valSchema,
          path: iPath,
          value: v,
        })
      )
    }

    console.log('HMM', [...args, ...vArgs])
    return [...args, ...vArgs]
  }

  const opType = DB_TYPE_TO_MODIFY_TYPE[fieldSchema.type]

  if (!opType) {
    console.error('Unsupported field type', path, fieldSchema, value)
    return []
  }

  return [opType, strPath, value]
}
