import { BasedSchema, BasedSchemaPartial } from '@based/schema'
import { BasedDbClient } from '../index.js'
import { NewTypeSchemaMutation, SchemaUpdateMode } from '../types.js'
import { findEdgeConstraints } from './findEdgeConstraints.js'
import { getMutations } from './getMutations.js'
import { mergeSchema } from './mergeSchema.js'
import { migrateNodes } from './migrateNodes.js'
import { validateSchemaMutations } from './validationRules.js'

type EdgeConstraint = {
  prefix: string
  isSingle: boolean
  arrayMode: boolean
  field: string
  bidirectional: { fromField: string }
}

export const DEFAULT_SCHEMA: BasedSchema = {
  $defs: {},
  language: 'en',
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

export async function updateSchema(
  client: BasedDbClient,
  opts: BasedSchemaPartial,
  _merge: boolean = true,
  mode: SchemaUpdateMode = SchemaUpdateMode.strict
): Promise<BasedSchema> {
  let currentSchema = client.schema
  if (!currentSchema) {
    // TODO: get schema from DB
    currentSchema = DEFAULT_SCHEMA
    client.schema = DEFAULT_SCHEMA

    // newTypes.push(['ro', 'root'])
    await client.command('hierarchy.types.add', ['ro', 'root'])
  }

  const mutations = getMutations(currentSchema, opts)
  // console.log('=======================================')
  // mutations.forEach((mutation) => {
  //   console.log(
  //     mutation.mutation,
  //     // @ts-ignore
  //     mutation.type,
  //     // @ts-ignore
  //     mutation.path,
  //     // @ts-ignore
  //     mutation.old,
  //     // @ts-ignore
  //     mutation.new
  //   )
  // })
  // console.log('---------------------------------------')

  const newSchema = mergeSchema(currentSchema, mutations)

  await validateSchemaMutations(
    client,
    currentSchema,
    newSchema,
    opts,
    mutations,
    mode
  )

  if (mode === SchemaUpdateMode.migration) {
    await migrateNodes(client, mutations)
  }

  // TODO: integrate this
  // EdgeConstraints
  const newConstraints: EdgeConstraint[] = []
  if (opts.types) {
    for (const typeName in opts.types) {
      const typeDef = opts.types[typeName]
      const prefix = typeDef.prefix
      findEdgeConstraints(prefix, [], typeDef, newConstraints)
    }
  }

  await client.set({
    $id: 'root',
    schema: newSchema,
  })

  const newTypeMutations: NewTypeSchemaMutation[] = mutations.filter(
    (mutation) => mutation.mutation === 'new_type'
  ) as NewTypeSchemaMutation[]
  if (newTypeMutations.length) {
    await Promise.all(
      newTypeMutations.map((mutation) => {
        return client.command('hierarchy.types.add', [
          newSchema.types[mutation.type].prefix,
          mutation.type,
        ])
      })
    )
  }

  if (newConstraints?.length) {
    await Promise.all(
      newConstraints.map(({ prefix, isSingle, arrayMode, bidirectional, field }) => {
        return client.command('hierarchy.addConstraint', [
          prefix,
          `${isSingle ? 'S' : ''}${!!bidirectional ? 'B' : ''}${arrayMode ? 'A' : ''}`,
          field,
          bidirectional?.fromField ?? '',
        ])
      })
    )
  }

  return newSchema
}
