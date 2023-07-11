import { BasedSchemaCollectProps } from '@based/schema'

const DB_TYPE_TO_MODIFY_TYPE = {
  string: '0',
}

export function toModifyArgs(props: BasedSchemaCollectProps[]): any[] {
  const args: any[] = []
  for (const prop of props) {
    const { fieldSchema, path, value } = prop
    // @ts-ignore
    const opType = DB_TYPE_TO_MODIFY_TYPE[fieldSchema.type]
    if (!opType) {
      console.error('Unsupported field type', path, fieldSchema, value)
      continue
    }

    args.push(opType, path.join('.'), value)
  }

  return args
}
