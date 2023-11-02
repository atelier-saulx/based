import {
  BasedSchema,
  BasedSchemaField,
  BasedSchemaFieldObject,
  BasedSchemaFieldPartial,
  BasedSchemaPartial,
  basedSchemaFieldTypes,
} from '@based/schema'
import {
  ChangeFieldSchemaMutation,
  ChangeTypeSchemaMutation,
  DeleteTypeSchemaMutation,
  NewFieldSchemaMutation,
  NewTypeSchemaMutation,
  RemoveFieldSchemaMutation,
  SchemaMutations,
  SchemaUpdateMode,
} from '../types'
import { getSchemaTypeFieldByPath } from '../util'
import { BasedDbClient } from '..'

type ArrayElement<ArrayType extends readonly unknown[]> =
  ArrayType extends readonly (infer ElementType)[] ? ElementType : never

type ExistingNodes = {
  [fullFieldPath: string]: number
}

type RulesContext = {
  currentSchema: BasedSchema
  mode: SchemaUpdateMode
  existingNodes: ExistingNodes
}
type MutationRule = (
  mutation: ArrayElement<SchemaMutations>,
  ctx: RulesContext
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
    if (typeWithSamePrefix && typeWithSamePrefix !== mutation.type) {
      throw new Error(`Prefix ${prefix} is already in use`)
    }
  }
}

const noChangesInStrictMode: MutationRule = (
  mutation:
    | ChangeTypeSchemaMutation
    | NewFieldSchemaMutation
    | ChangeFieldSchemaMutation
    | RemoveFieldSchemaMutation
    | DeleteTypeSchemaMutation,
  { mode }
) => {
  if (mode === SchemaUpdateMode.strict) {
    let path: string[]
    let action = 'change'
    if (
      mutation.mutation === 'new_field' ||
      mutation.mutation === 'change_field' ||
      mutation.mutation === 'remove_field'
    ) {
      path = [mutation.type].concat(mutation.path)
    } else {
      path = [mutation.type]
    }
    if (
      mutation.mutation === 'remove_field' ||
      mutation.mutation === 'delete_type'
    ) {
      action = 'remove'
    }
    throw new Error(`Cannot ${action} "${path.join('.')}" in strict mode.`)
  }
}

const checkAllFields = (
  fieldFn: (path: string[], field: BasedSchemaFieldPartial) => void,
  mutation:
    | NewTypeSchemaMutation
    | ChangeTypeSchemaMutation
    | NewFieldSchemaMutation
    | ChangeFieldSchemaMutation,
  ctx?: RulesContext,
  recursionPath: string[] = []
) => {
  if (
    mutation.mutation === 'new_field' ||
    mutation.mutation === 'change_field'
  ) {
    fieldFn(mutation.path, mutation.new)
  } else {
    for (const fieldName in recursionPath.length
      ? getSchemaTypeFieldByPath(mutation.new.fields, recursionPath)
      : mutation.new.fields) {
      const field = mutation.new.fields[fieldName]
      fieldFn(recursionPath.concat(fieldName), field)
      if (
        field.type === 'object' &&
        (field as BasedSchemaFieldObject).properties
      ) {
        checkAllFields(fieldFn, mutation, ctx, recursionPath.concat(fieldName))
      }
    }
  }
}

const onlyAllowedFieldTypes: MutationRule = (
  mutation:
    | NewTypeSchemaMutation
    | ChangeTypeSchemaMutation
    | NewFieldSchemaMutation
    | ChangeFieldSchemaMutation
) => {
  checkAllFields((path, field) => {
    if (!basedSchemaFieldTypes.includes(field.type)) {
      throw new Error(
        `Invalid field type "${field.type}" on "${mutation.type}.${path.join(
          '.'
        )}"`
      )
    }
  }, mutation)
}

const onlyAllowedArrayProperties: MutationRule = (
  mutation:
    | NewTypeSchemaMutation
    | ChangeTypeSchemaMutation
    | ChangeFieldSchemaMutation
) => {
  checkAllFields((path, field) => {
    if (field.type === 'array') {
      const keys = Object.keys(field)
      for (const k of keys) {
        if (!(k === 'type' || k === 'values')) {
          throw new Error(
            `Invalid property "${k}" for array definition on "${
              mutation.type
            }.${path.join('.')}"`
          )
        }
      }
    }
  }, mutation)
}

const getExistingNodes = async (
  client: BasedDbClient,
  mutations: SchemaMutations
) => {
  if (!mutations.length) {
    return
  }
  const query: any = {}
  mutations.forEach((mutation) => {
    // console.log('----- mutation', mutation)
    let path: string[] = []
    let isField = false
    if (
      mutation.mutation !== 'delete_type' &&
      mutation.mutation !== 'change_type' &&
      mutation.mutation !== 'new_type'
    ) {
      path = mutation.path
      isField = true
    }
    const fullFieldPath = [mutation.type].concat(path).join('.')
    query[fullFieldPath] = {
      $aggregate: {
        $function: 'count',
        $traverse: 'descendants',
        $filter: [
          {
            $field: 'type',
            $operator: '=',
            $value: mutation.type,
          },
        ],
        $limit: 1,
      },
    }
    if (isField) {
      query[fullFieldPath].$aggregate.$filter.push({
        $field: path.join('.'),
        $operator: 'exists',
      })
    }
  })
  return client.get(query)
}

const noMutationsOnFlexibleModeWithExistingNodes: MutationRule = (
  mutation: Exclude<ArrayElement<SchemaMutations>, NewTypeSchemaMutation>,
  { mode, existingNodes }
) => {
  if (mode === SchemaUpdateMode.flexible) {
    let fullPath: string
    if (
      mutation.mutation === 'delete_type' ||
      mutation.mutation === 'change_type'
    ) {
      fullPath = mutation.type
    } else {
      fullPath = [mutation.type].concat(mutation.path).join('.')
    }
    if (existingNodes[fullPath]) {
      throw new Error(
        `Cannot mutate "${fullPath}" in flexible mode with exsiting data.`
      )
    }
  }
}

export const validateSchemaMutations = async (
  client: BasedDbClient,
  currentSchema: BasedSchema,
  opts: BasedSchemaPartial,
  mutations: SchemaMutations,
  mode: SchemaUpdateMode
) => {
  let existingNodes: ExistingNodes = {}
  if (mode === SchemaUpdateMode.flexible) {
    existingNodes = await getExistingNodes(client, mutations)
  }
  console.log({ existingNodes })
  const ctx: RulesContext = {
    currentSchema,
    mode,
    existingNodes,
  }
  for (const mutation of mutations) {
    if (mutation.mutation === 'new_type') {
      cannotUserExistingPrefixes(mutation, ctx)
      onlyAllowedFieldTypes(mutation, ctx)
      onlyAllowedArrayProperties(mutation, ctx)
    } else if (mutation.mutation === 'change_type') {
      noChangesInStrictMode(mutation, ctx)
      onlyAllowedFieldTypes(mutation, ctx)
      onlyAllowedArrayProperties(mutation, ctx)
      noMutationsOnFlexibleModeWithExistingNodes(mutation, ctx)
    } else if (mutation.mutation === 'change_field') {
      noChangesInStrictMode(mutation, ctx)
      onlyAllowedFieldTypes(mutation, ctx)
      onlyAllowedArrayProperties(mutation, ctx)
      noMutationsOnFlexibleModeWithExistingNodes(mutation, ctx)
    } else if (mutation.mutation === 'remove_field') {
      noChangesInStrictMode(mutation, ctx)
      noMutationsOnFlexibleModeWithExistingNodes(mutation, ctx)
    } else if (mutation.mutation === 'delete_type') {
      noChangesInStrictMode(mutation, ctx)
      noMutationsOnFlexibleModeWithExistingNodes(mutation, ctx)
    }
  }
}
