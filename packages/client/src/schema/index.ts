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

function findEdgeConstraints(
  prefix: string,
  path: string[],
  typeSchema: any,
  constraints: EdgeConstraint[]
): void {
  if (typeSchema.fields) {
    for (const field in typeSchema.fields) {
      findEdgeConstraints(
        prefix,
        [field],
        typeSchema.fields[field],
        constraints
      )
    }
  }

  if (typeSchema.properties) {
    for (const field in typeSchema.properties) {
      findEdgeConstraints(
        prefix,
        [...path, field],
        typeSchema.properties[field],
        constraints
      )
    }
  }

  if (typeSchema.values) {
    findEdgeConstraints(prefix, [...path, '*'], typeSchema.values, constraints)
  }

  if (typeSchema.items) {
    findEdgeConstraints(prefix, [...path, '*'], typeSchema.items, constraints)
  }

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

      // TODO: generate one if taken
      const prefix = typeDef.prefix ?? oldDef?.prefix ?? typeName.slice(0, 2)

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

      findEdgeConstraints(prefix, [], typeDef, newConstraints)
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
