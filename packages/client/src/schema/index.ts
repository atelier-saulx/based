import { BasedSchema, BasedSchemaPartial, BasedSchemaType } from '@based/schema'
import { BasedDbClient } from '..'
import { deepCopy, deepMerge } from '@saulx/utils'
import { joinPath } from '../util'

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

// TODO: What is PartialObjectDeep<> type?
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
  typeDef: any,
  typeName: string
) => {
  if (
    currentSchema.types[typeName] &&
    currentSchema.types[typeName]?.prefix !== typeDef.prefix
  ) {
    throw new Error('Cannot change prefix of existing type')
  }
}

const CHARS = '1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
const MAXTRIES = Math.pow(CHARS.length, 2)
const prefixAlreadyExists = (prefix: string, currentSchema: BasedSchema) =>
  Object.keys(currentSchema.types)
    .map((typeName) => currentSchema.types[typeName].prefix)
    .includes(prefix)

const generateNewPrefix = (typeName: string, currentSchema: BasedSchema) => {
  let newPrefix = typeName.slice(0, 2)

  let counter = 0
  while (prefixAlreadyExists(newPrefix, currentSchema)) {
    if (counter > 0 && counter % CHARS.length) {
      newPrefix =
        CHARS[Math.floor(counter / CHARS.length)] + newPrefix.substring(1)
    }
    newPrefix = newPrefix.substring(0, 1) + CHARS[counter % CHARS.length]
    counter++
    if (counter > MAXTRIES) {
      throw new Error('No more prefixes available')
    }
  }
  return newPrefix
}

export async function updateSchema(
  client: BasedDbClient,
  opts: BasedSchemaPartial
): Promise<BasedSchema> {
  const newTypes: [string, string][] = []
  const newConstraints: EdgeConstraint[] = []

  let currentSchema = client.schema
  if (!currentSchema) {
    // TODO: get schema from DB
    currentSchema = DEFAULT_SCHEMA
    client.schema = DEFAULT_SCHEMA

    newTypes.push(['ro', 'root'])
  }
  const newSchema = deepCopy(currentSchema)

  if (opts.languages) {
    newSchema.languages = opts.languages
  }

  if (opts.root) {
    // TODO: guard for breaking changes
    deepMerge(newSchema.root, opts.root)
  }

  if (opts.types) {
    for (const typeName in opts.types) {
      const typeDef = opts.types[typeName]
      const oldDef = currentSchema[typeName]

      checkTypeWithSamePrefix(currentSchema, typeDef, typeName)
      checkChangingExistingTypePrefix(currentSchema, typeDef, typeName)

      const prefix =
        typeDef.prefix ??
        oldDef?.prefix ??
        generateNewPrefix(typeName, currentSchema)

      if (!oldDef) {
        const newDef: any = {
          prefix,
          fields: deepCopy(DEFAULT_FIELDS),
        }
        deepMerge(newDef, typeDef)
        newSchema.types[typeName] = newDef

        newTypes.push([prefix, typeName])
        newSchema.prefixToTypeMapping[prefix] = typeName
      } else {
        // TODO: guard for breaking changes
        newSchema.types[typeName] = deepMerge(oldDef, typeDef)
      }

      // findEdgeConstraints(prefix, [], typeDef, newConstraints)
      schemaWalker(prefix, [], typeDef, newConstraints, newSchema)
    }
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
