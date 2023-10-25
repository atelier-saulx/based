import {
  BasedSchema,
  BasedSchemaField,
  BasedSchemaLanguage,
  BasedSchemaPartial,
} from '@based/schema'
import { BasedDbClient } from '..'
import { deepMerge } from '@saulx/utils'
import { joinPath } from '../util'
import { generateNewPrefix } from './utils'
import { SchemaMutations, SchemaUpdateMode } from '../types'
import { BasedQuery } from '@based/client'
import { migrateNodes } from './migrateNodes'

type EdgeConstraint = {
  prefix: string
  isSingle: boolean
  field: string
  bidirectional: { fromField: string }
}

export const DEFAULT_SCHEMA: BasedSchema = {
  $defs: {},
  languages: ['en'],
  prefixToTypeMapping: {
    ro: 'root',
  },
  types: {},
  root: {
    fields: {
      schema: {
        type: 'json',
      },
      id: { type: 'string' },
      type: { type: 'string' },
      children: { type: 'references' },
      descendants: { type: 'references' },
      aliases: {
        type: 'set',
        items: { type: 'string' },
      },
    },
  },
}

export const DEFAULT_FIELDS: any = {
  id: { type: 'string' },
  createdAt: { type: 'timestamp' },
  updatedAt: { type: 'timestamp' },
  type: { type: 'string' },
  parents: { type: 'references' },
  children: { type: 'references' },
  ancestors: { type: 'references' },
  descendants: { type: 'references' },
  aliases: {
    type: 'set',
    items: { type: 'string' },
  },
}

const findEdgeConstraints = (
  prefix: string,
  path: string[],
  typeSchema: any,
  constraints: EdgeConstraint[]
) => {
  if (!['reference', 'references'].includes(typeSchema.type)) {
    return
  }

  const ref = {
    prefix,
    bidirectional: typeSchema.bidirectional
      ? { fromField: typeSchema?.bidirectional?.fromField }
      : undefined,
    isSingle: typeSchema.type === 'reference',
    field: joinPath(path),
  }

  if (!ref.bidirectional && !ref.isSingle) {
    return
  }

  constraints.push(ref)
}

const checkInvalidFieldType = (typeSchema: any) => {
  if (
    typeSchema.type &&
    ![
      'enum',
      'array',
      'object',
      'set',
      'record',
      'string',
      'boolean',
      'number',
      'json',
      'integer',
      'timestamp',
      'reference',
      'references',
      'text',
      'cardinality',
    ].includes(typeSchema.type)
  ) {
    throw new Error(`Invalid field type ${typeSchema.type}`)
  }
}

const checkArrayFieldTypeRequirements = (typeSchema: any) => {
  if (typeSchema?.type === 'array') {
    const keys = Object.keys(typeSchema)
    for (const k of keys) {
      if (!(k === 'type' || k === 'values')) {
        throw new Error(`Wrong field passed for type array on schema (${k})`)
      }
    }
  }
}

const checkTextFieldTypeRequirements = (
  typeSchema: any,
  newSchema: BasedSchema
) => {
  const hasLanguages = newSchema?.languages?.length > 0
  if (typeSchema?.type === 'text' && !hasLanguages) {
    throw new Error(
      'Cannot use fields of type text without `languages` being defined`'
    )
  }
}

function schemaWalker(
  prefix: string,
  path: string[],
  typeSchema: any,
  constraints: EdgeConstraint[],
  newSchema: BasedSchema
): void {
  if (typeSchema.fields) {
    for (const field in typeSchema.fields) {
      schemaWalker(
        prefix,
        [field],
        typeSchema.fields[field],
        constraints,
        newSchema
      )
    }
  }

  if (typeSchema.properties) {
    for (const field in typeSchema.properties) {
      schemaWalker(
        prefix,
        [...path, field],
        typeSchema.properties[field],
        constraints,
        newSchema
      )
    }
  }

  if (typeSchema.values) {
    schemaWalker(
      prefix,
      [...path, '*'],
      typeSchema.values,
      constraints,
      newSchema
    )
  }

  if (typeSchema.items) {
    schemaWalker(
      prefix,
      [...path, '*'],
      typeSchema.items,
      constraints,
      newSchema
    )
  }

  checkInvalidFieldType(typeSchema)
  checkArrayFieldTypeRequirements(typeSchema)
  checkTextFieldTypeRequirements(typeSchema, newSchema)
  findEdgeConstraints(prefix, path, typeSchema, constraints)
}

const checkTypeWithSamePrefix = (
  currentSchema: any,
  typeDef: any,
  typeName: string
) => {
  const typeWithSamePrefix =
    typeDef.prefix === 'ro'
      ? 'ro'
      : Object.keys(currentSchema.types).find(
        (name) => currentSchema.types[name].prefix === typeDef.prefix
      )
  if (typeWithSamePrefix && typeWithSamePrefix !== typeName) {
    throw new Error(`Prefix ${typeDef.prefix} is already in use`)
  }
}

const checkChangingExistingTypePrefix = (
  currentSchema: any,
  prefix: string,
  typeName: string
) => {
  if (
    currentSchema.types[typeName] &&
    currentSchema.types[typeName]?.prefix !== prefix
  ) {
    throw new Error('Cannot change prefix of existing type')
  }
}

function mergeLanguages(
  oldLangs: BasedSchemaLanguage[],
  newLangs: BasedSchemaLanguage[]
): BasedSchemaLanguage[] {
  const langs: Set<BasedSchemaLanguage> = new Set()

  // TODO: have default lang?

  // if (!Array.isArray(oldLangs)) {
  //   oldLangs = ['en']
  // }
  if (!Array.isArray(oldLangs)) {
    oldLangs = []
  }
  for (const lang of oldLangs) {
    langs.add(lang)
  }

  if (!Array.isArray(newLangs)) {
    newLangs = []
  }
  for (const lang of newLangs) {
    langs.add(lang)
  }

  return [...langs.values()]
}

const mergeFields = (
  path: string[],
  currentFields: { [name: string]: BasedSchemaField },
  requestedFields: { [name: string]: BasedSchemaField },
  mutations: SchemaMutations,
  merge: boolean,
  mode: SchemaUpdateMode
) => {
  const currentFieldsNames = Object.keys(currentFields || {})
  const newFieldsNames = Object.keys(requestedFields || {})
  const fieldsToParse = new Set([...currentFieldsNames, ...newFieldsNames])

  const newFields: { [name: string]: BasedSchemaField } = {}

  for (const fieldName of fieldsToParse) {
    const currentFieldDef: BasedSchemaField = currentFields[fieldName]
    const requestedFieldDef: BasedSchemaField = requestedFields[fieldName]

    if (
      // TODO: add $delete to BasedSchemaField
      // @ts-ignore
      requestedFieldDef?.$delete ||
      (merge === false && !newFieldsNames.includes(fieldName))
    ) {
      // field to remove
      if (mode === SchemaUpdateMode.strict) {
        throw new Error(`Cannot remove "${path.join('.')}.${fieldName}" in strict mode.`)
      }
      mutations.push({
        mutation: 'remove_field',
        type: path[0],
        path: path.slice(1).concat(fieldName),
        old: currentFieldDef,
      })
      continue
    }

    if (!currentFieldsNames.includes(fieldName)) {
      // new field
      newFields[fieldName] = requestedFieldDef
    } else {
      // existing field
      if (
        requestedFieldDef?.type &&
        requestedFieldDef.type !== currentFieldDef.type
      ) {
        if (mode === SchemaUpdateMode.strict) {
          throw new Error(`Cannot change "${path.join('.')}.${fieldName}" in strict mode.`)
        }
        mutations.push({
          mutation: 'change_field',
          type: path[0],
          path: path.slice(1).concat(fieldName),
          old: currentFieldDef,
          new: { ...currentFieldDef, ...requestedFieldDef },
        })
      }

      newFields[fieldName] = { ...currentFieldDef, ...requestedFieldDef }
    }

    if (newFields[fieldName].type === 'object') {
      // @ts-ignore
      newFields[fieldName].properties = mergeFields(
        [...path, fieldName],
        // @ts-ignore
        currentFieldDef?.properties || {},
        // @ts-ignore
        requestedFieldDef?.properties || {},
        mutations,
        merge,
        mode
      )
    }
  }

  return newFields
}

const checkMutationsForExistingNodes = async (client: BasedDbClient, mutations: SchemaMutations) => {
  if (!mutations.length) {
    return
  }
  const query: any = {}
  mutations.forEach((mutation) => {
    // console.log('----- mutation', mutation)
    let path: string[] = []
    if (mutation.mutation !== 'delete_type') {
      path = mutation.path
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
          {
            $field: path.join('.'),
            $operator: 'exists'
          }
        ],
        $limit: 1,
      },
    }
  })
  const result = await client.get(query)
  for (const fullFieldPath in result) {
    if (result[fullFieldPath] > 0) {
      throw new Error(`Cannot mutate "${fullFieldPath}" in flexible mode with exsiting data.`)
    }
  }
}

export async function updateSchema(
  client: BasedDbClient,
  opts: BasedSchemaPartial,
  merge: boolean = true,
  mode: SchemaUpdateMode = SchemaUpdateMode.strict
): Promise<BasedSchema> {
  const newTypes: [string, string][] = []
  const typesToDelete: [string, string][] = []
  const newConstraints: EdgeConstraint[] = []
  const mutations: SchemaMutations = []

  let currentSchema = client.schema
  if (!currentSchema) {
    // TODO: get schema from DB
    currentSchema = DEFAULT_SCHEMA
    client.schema = DEFAULT_SCHEMA

    newTypes.push(['ro', 'root'])
  }
  // const newSchema = deepCopy(currentSchema)
  const newSchema: BasedSchema = {
    $defs: {},
    languages: [],
    prefixToTypeMapping: {},
    root: { fields: {} },
    types: {},
  }

  newSchema.languages = mergeLanguages(currentSchema.languages, opts.languages)

  newSchema.root = currentSchema.root
  newSchema.root.fields = mergeFields(
    ['root'],
    newSchema.root.fields,
    currentSchema.root.fields,
    mutations,
    true,
    mode
  )
  deepMerge(newSchema.root, opts.root)
  newSchema.prefixToTypeMapping = currentSchema.prefixToTypeMapping

  const currentTypeNames = Object.keys(currentSchema.types || {})
  const optsTypeNames = Object.keys(opts.types || {})
  const typesToParse = new Set([...currentTypeNames, ...optsTypeNames])

  for (const typeName of typesToParse) {
    const typeDef = (opts as BasedSchema).types[typeName]
    const oldDef = currentSchema.types[typeName]
    if (
      // TODO: Remove when @based/schema is updated
      // @ts-ignore
      typeDef?.$delete ||
      (merge === false && !optsTypeNames.includes(typeName))
    ) {
      // type to delete
      if (mode === SchemaUpdateMode.strict) {
        throw new Error(`Cannot remove "${typeName}" in strict mode.`)
      }
      typesToDelete.push([oldDef?.prefix, typeName])
      mutations.push({
        mutation: 'delete_type',
        type: typeName,
      })
      continue
    }

    const prefix =
      typeDef?.prefix ??
      oldDef?.prefix ??
      generateNewPrefix(typeName, currentSchema)

    if (!currentTypeNames.includes(typeName)) {
      // new type

      checkTypeWithSamePrefix(currentSchema, typeDef, typeName)
      // const newDef: any = {
      //   prefix,
      //   fields: deepCopy(DEFAULT_FIELDS),
      // }
      // deepMerge(newDef, typeDef)
      const newDef = {
        ...typeDef,
        prefix,
        fields: mergeFields(
          [typeName],
          {},
          { ...DEFAULT_FIELDS, ...typeDef.fields },
          mutations,
          merge,
          mode
        ),
      }
      newSchema.types[typeName] = newDef

      newTypes.push([prefix, typeName])
      newSchema.prefixToTypeMapping[prefix] = typeName
    } else {
      // existing type

      checkChangingExistingTypePrefix(currentSchema, prefix, typeName)

      // TODO: guard for breaking changes
      // newSchema.types[typeName] = merge ? deepMerge(oldDef, typeDef) : typeDef
      if (merge) {
        newSchema.types[typeName] = {
          ...typeDef,
          fields: mergeFields(
            [typeName],
            oldDef.fields,
            { ...DEFAULT_FIELDS, ...(typeDef?.fields || oldDef?.fields || {}) },
            mutations,
            merge,
            mode
          ),
        }
      } else {
        newSchema.types[typeName] = typeDef
      }
    }

    schemaWalker(
      prefix,
      [],
      newSchema.types[typeName],
      newConstraints,
      newSchema
    )
  }

  // if (opts.types) {
  //   for (const typeName in opts.types) {
  //     const typeDef = opts.types[typeName]
  //     const oldDef = currentSchema[typeName]
  //
  //     checkTypeWithSamePrefix(currentSchema, typeDef, typeName)
  //     checkChangingExistingTypePrefix(currentSchema, typeDef, typeName)
  //
  //     const prefix =
  //       typeDef.prefix ??
  //       oldDef?.prefix ??
  //       generateNewPrefix(typeName, currentSchema)
  //
  //     if (!oldDef) {
  //       const newDef: any = {
  //         prefix,
  //         fields: deepCopy(DEFAULT_FIELDS),
  //       }
  //       deepMerge(newDef, typeDef)
  //       newSchema.types[typeName] = newDef
  //
  //       newTypes.push([prefix, typeName])
  //       newSchema.prefixToTypeMapping[prefix] = typeName
  //     } else {
  //       // TODO: guard for breaking changes
  //       newSchema.types[typeName] = deepMerge(oldDef, typeDef)
  //     }
  //
  //     // findEdgeConstraints(prefix, [], typeDef, newConstraints)
  //     schemaWalker(prefix, [], typeDef, newConstraints, newSchema)
  //   }
  // }

  if (mode === SchemaUpdateMode.flexible) {
    await checkMutationsForExistingNodes(client, mutations)
  } else {
    await migrateNodes(client, mutations)
  }

  await client.set({
    $id: 'root',
    schema: newSchema,
  })

  if (newTypes?.length) {
    await Promise.all(
      newTypes.map(([prefix, typeName]) => {
        return client.command('hierarchy.types.add', [prefix, typeName])
      })
    )
  }

  if (newConstraints?.length) {
    await Promise.all(
      newConstraints.map(({ prefix, isSingle, bidirectional, field }) => {
        console.log('yoyo', [
          prefix,
          `${isSingle ? 'S' : ''}${!!bidirectional ? 'B' : ''}`,
          field,
          bidirectional?.fromField ?? '',
        ])
        return client.command('hierarchy.addConstraint', [
          prefix,
          `${isSingle ? 'S' : ''}${!!bidirectional ? 'B' : ''}`,
          field,
          bidirectional?.fromField ?? '',
        ])
      })
    )
  }

  return newSchema
}
