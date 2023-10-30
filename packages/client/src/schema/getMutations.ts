import {
  BasedSchema,
  BasedSchemaPartial,
  BasedSchemaType,
  BasedSchemaTypePartial,
} from '@based/schema'
import { SchemaMutations } from '../types'

const diffType = (
  path: string[],
  currentType: BasedSchemaType,
  optsType: BasedSchemaTypePartial
): SchemaMutations => {
  // console.log({
  //   path,
  //   currentType,
  //   optsType,
  // })
  const mutations: SchemaMutations = []

  if (optsType?.$delete) {
    // type to delete
    mutations.push({
      mutation: 'delete_type',
      type: path[0],
    })
    return mutations
  }

  if (!currentTypeNames.includes(typeName)) {
    // new type
  }

  return mutations
}

export const getMutations = (
  currentSchema: BasedSchema,
  opts: BasedSchemaPartial
) => {
  const mutations: SchemaMutations = []

  const currentTypeNames = Object.keys(currentSchema.types || {})
  const optsTypeNames = Object.keys(opts.types || {})
  const typesToParse = new Set([...currentTypeNames, ...optsTypeNames])

  for (const typeName of typesToParse) {
    const newMutations = diffType(
      [typeName],
      currentSchema.types[typeName],
      opts.types[typeName]
    )
    console.log('------', { newMutations })
    mutations.push(...newMutations)
  }

  console.log({ mutations })
}
