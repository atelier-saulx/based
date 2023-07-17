import { BasedSchemaCollectProps, BasedSchemaFieldArray } from '@based/schema'
import { toModifyArgs } from '.'
import { ModifyArgType, ModifyOpSetType } from '../protocol/encode/modify/types'

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
  const strPath = path.join('.')

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
