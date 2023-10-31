import { BasedSchema, BasedSchemaPartial } from '@based/schema'
import { SchemaMutations } from '../../dist/types'
import {
  ChangeFieldSchemaMutation,
  ChangeTypeSchemaMutation,
  NewTypeSchemaMutation,
  SchemaUpdateMode,
} from '../types'

type ArrayElement<ArrayType extends readonly unknown[]> =
  ArrayType extends readonly (infer ElementType)[] ? ElementType : never

type MutationRule = (
  mutation: ArrayElement<SchemaMutations>,
  ctx: {
    currentSchema: BasedSchema
    mode: SchemaUpdateMode
  }
) => void

const cannotUserExistingPrefixes: MutationRule = (
  mutation: NewTypeSchemaMutation,
  { currentSchema }
) => {
  const prefix = mutation.new.prefix
  if (prefix) {
    const typeWithSamePrefix =
      prefix === 'ro'
        ? 'ro'
        : Object.keys(currentSchema.types).find(
            (name) => currentSchema.types[name].prefix === prefix
          )
    console.log('-----0000', prefix, currentSchema, typeWithSamePrefix)
    if (typeWithSamePrefix && typeWithSamePrefix !== mutation.type) {
      throw new Error(`Prefix ${prefix} is already in use`)
    }
  }
}

const cannotChangeTypeInStrictMode: MutationRule = (
  mutation: ChangeFieldSchemaMutation,
  { mode }
) => {
  if (mode === SchemaUpdateMode.strict) {
    throw new Error(`Cannot change "${mutation.type}" in strict mode.`)
  }
}

const onlyAllowedTypes: MutationRule = (
  mutation: NewTypeSchemaMutation | ChangeTypeSchemaMutation
) => {
  if (mutation.new.type) {
  }
}

export const validateSchemaMutations = (
  currentSchema: BasedSchema,
  opts: BasedSchemaPartial,
  mutations: SchemaMutations,
  mode: SchemaUpdateMode
) => {
  const ctx = {
    currentSchema,
    mode,
  }
  for (const mutation of mutations) {
    if (mutation.mutation === 'new_type') {
      cannotUserExistingPrefixes(mutation, ctx)
    } else if (mutation.mutation === 'change_type') {
      cannotChangeTypeInStrictMode(mutation, ctx)
    }
  }
}
