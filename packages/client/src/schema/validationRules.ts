import {
  BasedSchema,
  BasedSchemaFieldArray,
  BasedSchemaFieldObject,
  BasedSchemaFieldPartial,
  BasedSchemaFieldRecord,
  BasedSchemaFieldSet,
  BasedSchemaLanguage,
  BasedSchemaPartial,
  basedSchemaFieldTypes,
  languages,
} from '@based/schema'
import { BasedDbClient } from '../index.js'
import {
  ChangeFieldSchemaMutation,
  ChangeLanguagesMutation,
  ChangeTypeSchemaMutation,
  DeleteTypeSchemaMutation,
  NewFieldSchemaMutation,
  NewTypeSchemaMutation,
  RemoveFieldSchemaMutation,
  SchemaMutation,
  SchemaUpdateMode,
} from '../types.js'
import { getSchemaTypeFieldByPath } from '../util/index.js'
import { DEFAULT_FIELDS } from './mergeSchema.js'
import { deepCopy, deepEqual, deepMerge } from '@saulx/utils'

type ExistingNodes = {
  [fullFieldPath: string]: number
}

type RulesContext = {
  currentSchema: BasedSchema
  newSchema: BasedSchema
  mode: SchemaUpdateMode
  existingNodes: ExistingNodes
}
type MutationRule = (mutation: SchemaMutation, ctx: RulesContext) => void

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
    | ChangeFieldSchemaMutation
    | RemoveFieldSchemaMutation,
  ctx?: RulesContext,
  recursionPath: string[] = []
) => {
  if (mutation.mutation === 'new_field') {
    fieldFn(mutation.path, mutation.new)
  } else if (mutation.mutation === 'change_field') {
    fieldFn(mutation.path, deepMerge(deepCopy(mutation.old), mutation.new))
  } else if (mutation.mutation !== 'remove_field') {
    for (const fieldName in recursionPath.length
      ? getSchemaTypeFieldByPath(mutation.new.fields, recursionPath)
      : mutation.new.fields) {
      let field: any
      if (mutation.mutation === 'new_type') {
        field = mutation.new.fields[fieldName]
      } else if (mutation.mutation === 'change_type') {
        field = deepMerge(
          mutation.old.fields[fieldName],
          mutation.new.fields[fieldName]
        )
      } else {
        throw new Error('Invalid mutation')
      }
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

    if (
      field.type === 'array' &&
      (!(field as BasedSchemaFieldArray).values ||
        !(field as BasedSchemaFieldArray).values.type)
    ) {
      throw new Error(
        `Field "${mutation.type}.${path.join(
          '.'
        )}" is of type "array" but does not include a valid "values" property.`
      )
    } else if (
      field.type === 'record' &&
      (!(field as BasedSchemaFieldRecord).values ||
        !(field as BasedSchemaFieldRecord).values.type)
    ) {
      throw new Error(
        `Field "${mutation.type}.${path.join(
          '.'
        )}" is of type "record" but does not include a valid "values" property.`
      )
    } else if (
      field.type === 'set' &&
      (!(field as BasedSchemaFieldSet).items ||
        !(field as BasedSchemaFieldSet).items.type)
    ) {
      throw new Error(
        `Field "${mutation.type}.${path.join(
          '.'
        )}" is of type "set" but does not include a valid "items" property.`
      )
    } else if (field.type === 'object') {
      if (!(field as BasedSchemaFieldObject).properties) {
        throw new Error(
          `Field "${mutation.type}.${path.join(
            '.'
          )}" is of type "object" but does not include a valid "properties" property.`
        )
      }
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

const validateLanguages: MutationRule = (
  mutation: ChangeLanguagesMutation,
  { currentSchema }
) => {
  if (
    mutation.new.language !== undefined &&
    (!mutation.new.language || !languages.includes(mutation.new.language))
  ) {
    throw new Error(`Invalid language "${mutation.new.language}".`)
  }

  const configuredLanguages = [
    mutation.new.language || currentSchema.language,
  ].concat(mutation.new.translations || currentSchema.translations)

  if (mutation.new.translations !== undefined) {
    mutation.new.translations.forEach((lang) => {
      if (!languages.includes(lang)) {
        throw new Error(`Invalid language "${lang}".`)
      }
      if (!configuredLanguages.includes(lang)) {
        throw new Error(`Language "${lang}" is not configured.`)
      }
    })
  }
  if (mutation.new.languageFallbacks !== undefined) {
    Object.keys(mutation.new.languageFallbacks).forEach((key) => {
      if (!Array.isArray(mutation.new.languageFallbacks[key])) {
        throw new Error(
          `Language fallbacks for language "${key}" should be an array.`
        )
      }
      if (!languages.includes(key)) {
        throw new Error(`Invalid language "${key}".`)
      }
      mutation.new.languageFallbacks[key].forEach(
        (lang: BasedSchemaLanguage) => {
          if (!configuredLanguages.includes(lang)) {
            throw new Error(`Language "${key}" cannot fallback to "${lang}".`)
          }
        }
      )
    })
  }
}

const getExistingNodes = async (
  client: BasedDbClient,
  mutations: SchemaMutation[]
) => {
  if (!mutations.length) {
    return
  }
  const query: any = {}
  mutations.forEach((mutation) => {
    if (mutation.mutation === 'change_languages') {
      return
    }
    // console.log('----- mutation', mutation)
    let path: string[] = []
    let isField = false
    if (
      mutation.mutation === 'new_field' ||
      mutation.mutation === 'change_field' ||
      mutation.mutation === 'remove_field'
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
  mutation:
    | DeleteTypeSchemaMutation
    | ChangeTypeSchemaMutation
    | NewFieldSchemaMutation
    | ChangeFieldSchemaMutation
    | RemoveFieldSchemaMutation,
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

const cannotDeleteRoot: MutationRule = (mutation: DeleteTypeSchemaMutation) => {
  if (mutation.type === 'root') {
    throw new Error('Cannot delete root.')
  }
}

const noDefaultFieldMutations: MutationRule = (mutation: SchemaMutation) => {
  const defaultFields = Object.keys(DEFAULT_FIELDS)

  if (mutation.mutation === 'new_type' || mutation.mutation === 'change_type') {
    Object.keys(mutation.new.fields).forEach((fieldName) => {
      if (
        defaultFields.includes(fieldName) &&
        !deepEqual(DEFAULT_FIELDS[fieldName], mutation.new.fields[fieldName])
      ) {
        throw new Error(`Cannot change default field "${fieldName}".`)
      }
    })
  } else if (
    mutation.mutation === 'new_field' ||
    mutation.mutation === 'change_field'
  ) {
    if (
      mutation.path.length === 1 &&
      defaultFields.includes(mutation.path[0]) &&
      !deepEqual(DEFAULT_FIELDS[mutation.path[0]], mutation.new)
    ) {
      throw new Error(`Cannot change default field "${mutation.path[0]}".`)
    }
  } else if (mutation.mutation === 'remove_field') {
    if (
      mutation.path.length === 1 &&
      defaultFields.includes(mutation.path[0])
    ) {
      throw new Error(`Cannot change default field "${mutation.path[0]}".`)
    }
  }
}

const cannotDeleteLastProperties: MutationRule = (
  mutation: RemoveFieldSchemaMutation,
  { newSchema }
) => {
  const parentField = getSchemaTypeFieldByPath(
    mutation.type === 'root' ? newSchema.root : newSchema.types[mutation.type],
    mutation.path.slice(0, -1)
  )
  if (
    parentField?.type === 'object' &&
    !Object.keys(parentField.properties).length
  ) {
    throw new Error(
      `Cannot remove last property of object field "${
        mutation.type
      }.${mutation.path.slice(0, -1).join('.')}".`
    )
  }
}

export const validateSchemaMutations = async (
  client: BasedDbClient,
  currentSchema: BasedSchema,
  newSchema: BasedSchema,
  _opts: BasedSchemaPartial,
  mutations: SchemaMutation[],
  mode: SchemaUpdateMode
) => {
  let existingNodes: ExistingNodes = {}
  if (mode === SchemaUpdateMode.flexible) {
    existingNodes = await getExistingNodes(client, mutations)
  }
  const ctx: RulesContext = {
    currentSchema,
    newSchema,
    mode,
    existingNodes,
  }
  for (const mutation of mutations) {
    if (mutation.mutation === 'new_type') {
      cannotUserExistingPrefixes(mutation, ctx)
      onlyAllowedFieldTypes(mutation, ctx)
      noDefaultFieldMutations(mutation, ctx)
      onlyAllowedArrayProperties(mutation, ctx)
    } else if (mutation.mutation === 'change_type') {
      noChangesInStrictMode(mutation, ctx)
      onlyAllowedFieldTypes(mutation, ctx)
      noDefaultFieldMutations(mutation, ctx)
      onlyAllowedArrayProperties(mutation, ctx)
      noMutationsOnFlexibleModeWithExistingNodes(mutation, ctx)
    } else if (mutation.mutation === 'delete_type') {
      noChangesInStrictMode(mutation, ctx)
      cannotDeleteRoot(mutation, ctx)
      noMutationsOnFlexibleModeWithExistingNodes(mutation, ctx)
    } else if (mutation.mutation === 'new_field') {
      noDefaultFieldMutations(mutation, ctx)
      onlyAllowedFieldTypes(mutation, ctx)
      onlyAllowedArrayProperties(mutation, ctx)
    } else if (mutation.mutation === 'change_field') {
      noChangesInStrictMode(mutation, ctx)
      noDefaultFieldMutations(mutation, ctx)
      onlyAllowedFieldTypes(mutation, ctx)
      onlyAllowedArrayProperties(mutation, ctx)
      noMutationsOnFlexibleModeWithExistingNodes(mutation, ctx)
    } else if (mutation.mutation === 'remove_field') {
      noChangesInStrictMode(mutation, ctx)
      noDefaultFieldMutations(mutation, ctx)
      cannotDeleteLastProperties(mutation, ctx)
      noMutationsOnFlexibleModeWithExistingNodes(mutation, ctx)
    } else if (mutation.mutation === 'change_languages') {
      validateLanguages(mutation, ctx)
    }
  }
}
