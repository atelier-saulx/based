import { BasedSchemaField } from '@based/schema'
import { deepMerge, getByPath, setByPath } from '@saulx/utils'
import { aliasStrToPath } from '../../../util/index.js'

export function setResultValue({
  path,
  fieldSchema,
  obj,
  value,
}: {
  path: string
  fieldSchema: BasedSchemaField
  obj: any
  value: any
}) {
  const parsedPath = aliasStrToPath(path)
  if (['object', 'record', 'text', 'reference'].includes(fieldSchema.type)) {
    const currentValue = getByPath(obj, parsedPath)
    if (typeof currentValue === 'object') {
      deepMerge(currentValue, value)
    } else {
      setByPath(obj, parsedPath, value)
    }
  } else {
    setByPath(obj, parsedPath, value)
  }
}
