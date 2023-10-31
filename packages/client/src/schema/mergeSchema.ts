import { BasedSchema, BasedSchemaType } from '@based/schema'
import { deepCopy, deepMerge } from '@saulx/utils'
import { SchemaMutations } from '../types'

export const mergeSchema = (
  currentSchema: BasedSchema,
  mutations: SchemaMutations
) => {
  const newSchema = deepCopy(currentSchema)
  // TODO: check changes to root

  for (const mutation of mutations) {
    if (mutation.mutation === 'delete_type') {
      delete newSchema.types[mutation.type]
    } else if (mutation.mutation === 'remove_field') {
      throw new Error('>>>>> implement!!!')
    } else if (mutation.mutation === 'new_type') {
      newSchema.types[mutation.type] = mutation.new as BasedSchemaType
    } else if (mutation.mutation === 'change_type') {
      deepMerge(newSchema.types[mutation.type], mutation.new)
    } else if (mutation.mutation === 'new_field') {
      throw new Error('>>>>> implement!!!')
    } else if (mutation.mutation === 'change_field') {
      throw new Error('>>>>> implement!!!')
    } else {
      throw new Error('Unknow mutation type')
    }
  }

  return newSchema
}
