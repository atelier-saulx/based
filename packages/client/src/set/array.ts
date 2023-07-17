import { BasedSchemaCollectProps, BasedSchemaFieldArray } from '@based/schema'
import { toModifyArgs } from '.'
import { ModifyArgType } from '../protocol/encode/modify/types'
import { joinPath } from '../util'

const DB_TYPE_TO_ARY_TYPE = {
  string: 0,
  int: 2,
  float: 1,
  number: 1,
  object: 4,
  record: 4,
}

export function arrayOpToModify(props: BasedSchemaCollectProps) {
  const { fieldSchema, path, value } = props
  const strPath = joinPath(path)

  const args = []
  const iPath = [...path]
  let vals = []

  const valSchema = (<BasedSchemaFieldArray>fieldSchema).values

  const valType = DB_TYPE_TO_ARY_TYPE[valSchema.type]

  console.log('interesting', path, value)
  if (value.$push) {
    args.push(ModifyArgType.SELVA_MODIFY_ARG_OP_ARRAY_PUSH, strPath, valType)

    vals = value.$push
    iPath.push(-1)
  } else if (value.$unshift) {
    args.push(ModifyArgType.SELVA_MODIFY_ARG_OP_ARRAY_INSERT, strPath, valType)

    vals = [...value.$unshift].reverse()
    iPath.push(0)
  } else if (value.$insert) {
    args.push(ModifyArgType.SELVA_MODIFY_ARG_OP_ARRAY_INSERT, strPath, valType)

    vals = [...value.$insert.$value].reverse()
    iPath.push(value.$insert.$idx)
  } else if (value.$assign) {
    iPath.push(value.$assign.$idx)
    return toModifyArgs(<any>{
      fieldSchema: valSchema,
      path: iPath,
      value: value.$assign.$value,
    })
  } else if (value.$remove) {
    return [
      ModifyArgType.SELVA_MODIFY_ARG_OP_ARRAY_REMOVE,
      strPath,
      value.$remove.$idx,
    ]
  }

  for (const v of vals) {
    args.push(
      ...toModifyArgs(<any>{
        fieldSchema: valSchema,
        path: iPath,
        value: v,
      })
    )
  }

  console.log('ARGS', args)
  return args
}
