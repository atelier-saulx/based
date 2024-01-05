import {
  BasedSchema,
  BasedSchemaField,
  BasedSchemaFieldObject,
  BasedSchemaFieldPartial,
  BasedSchemaFieldRecord,
  BasedSchemaPartial,
  BasedSchemaType,
  BasedSchemaTypePartial,
} from '@based/schema'
import { deepEqual } from '@saulx/utils'
import { SchemaMutation } from '../types.js'

const diffField = (
  typeName: string,
  path: string[],
  currentField: BasedSchemaField,
  optsField: BasedSchemaFieldPartial
) => {
  const mutations: SchemaMutation[] = []

  // @ts-ignore
  if (optsField?.$delete) {
    // field to remove
    mutations.push({
      mutation: 'remove_field',
      type: typeName,
      path,
      old: currentField,
    })
    return mutations
  }

  // TODO: make more explicit?
  if (
    currentField.type === 'object' &&
    (currentField as BasedSchemaFieldObject).properties
  ) {
    mutations.push(
      ...diffFields(
        typeName,
        path,
        (currentField as BasedSchemaFieldObject).properties,
        (optsField as BasedSchemaFieldObject)?.properties
      )
    )
  }

  if (
    currentField.type === 'record' &&
    (currentField as BasedSchemaFieldRecord).values?.type === 'object'
  ) {
    mutations.push(
      ...diffFields(
        typeName,
        path,
        (
          (currentField as BasedSchemaFieldRecord)
            .values as BasedSchemaFieldObject
        ).properties,
        (
          (optsField as BasedSchemaFieldRecord)
            ?.values as BasedSchemaFieldObject
        )?.properties
      )
    )
  }

  const currentFieldProperties = Object.keys(currentField || {})
  const optsFieldProperties = Object.keys(optsField || {})
  const fieldPropertiesToParse = new Set([
    ...currentFieldProperties,
    ...optsFieldProperties,
  ])
  fieldPropertiesToParse.delete('properties')
  if (
    currentField.type === 'record' &&
    (currentField as BasedSchemaFieldRecord).values.type === 'object'
  ) {
    fieldPropertiesToParse.delete('values')
  }

  for (const fieldProperty of fieldPropertiesToParse) {
    if (
      optsField &&
      optsField[fieldProperty] &&
      currentField[fieldProperty] !== optsField[fieldProperty]
    ) {
      mutations.push({
        mutation: 'change_field',
        type: typeName,
        path,
        old: currentField,
        new: optsField,
      })
      continue
    }
  }

  return mutations
}

const diffFields = (
  typeName: string,
  path: string[],
  currentFields: { [fieldName: string]: BasedSchemaField },
  optsFields: { [fieldName: string]: BasedSchemaFieldPartial }
) => {
  const mutations: SchemaMutation[] = []

  const currentFieldsNames = Object.keys(currentFields || {})
  const optsFieldsNames = Object.keys(optsFields || {})
  const fieldsToParse = new Set([...currentFieldsNames, ...optsFieldsNames])

  for (const fieldName of fieldsToParse) {
    if (!currentFieldsNames.includes(fieldName)) {
      // new field
      mutations.push({
        mutation: 'new_field',
        type: typeName,
        path: path.concat(fieldName),
        new: optsFields[fieldName],
      })
      continue
    }

    // existing field
    mutations.push(
      ...diffField(
        typeName,
        path.concat(fieldName),
        currentFields[fieldName],
        optsFields && optsFields[fieldName]
      )
    )
  }
  return mutations
}

const diffType = (
  typeName: string,
  currentType: BasedSchemaType,
  optsType: BasedSchemaTypePartial
): SchemaMutation[] => {
  const mutations: SchemaMutation[] = []

  mutations.push(
    ...diffFields(typeName, [], currentType.fields, optsType?.fields)
  )

  const currentTypeProperties = Object.keys(currentType || {})
  const optsTypeProperties = Object.keys(optsType || {})
  const typePropertiesToParse = new Set([
    ...currentTypeProperties,
    ...optsTypeProperties,
  ])
  typePropertiesToParse.delete('fields')

  for (const typeProperty of typePropertiesToParse) {
    if (
      optsType &&
      optsType[typeProperty] &&
      currentType[typeProperty] !== optsType[typeProperty]
    ) {
      mutations.push({
        mutation: 'change_type',
        type: typeName,
        old: currentType,
        new: optsType,
      })
      continue
    }
  }
  return mutations
}

const diffTypes = (
  currentTypes: { [type: string]: BasedSchemaType },
  optsTypes: { [type: string]: BasedSchemaTypePartial }
): SchemaMutation[] => {
  const mutations: SchemaMutation[] = []

  const currentTypeNames = Object.keys(currentTypes || {})
  const optsTypeNames = Object.keys(optsTypes || {})
  const typesToParse = new Set([...currentTypeNames, ...optsTypeNames])

  for (const typeName of typesToParse) {
    if (optsTypes[typeName]?.$delete) {
      // type to delete
      mutations.push({
        mutation: 'delete_type',
        type: typeName,
      })
      continue
    }

    if (!currentTypeNames.includes(typeName)) {
      // new type
      mutations.push({
        mutation: 'new_type',
        type: typeName,
        new: optsTypes[typeName],
      })
      continue
    }

    // existing type
    const newMutations = diffType(
      typeName,
      currentTypes[typeName],
      optsTypes[typeName]
    )
    mutations.push(...newMutations)
  }

  return mutations
}

export const getMutations = (
  currentSchema: BasedSchema,
  opts: BasedSchemaPartial
) => {
  const mutations: SchemaMutation[] = []

  if (
    (opts.language !== undefined && opts.language !== currentSchema.language) ||
    (opts.translations !== undefined &&
      opts.translations !== currentSchema.translations) ||
    (opts.languageFallbacks !== undefined &&
      opts.languageFallbacks &&
      !deepEqual(opts.languageFallbacks, currentSchema.languageFallbacks))
  ) {
    mutations.push({
      mutation: 'change_languages',
      old: {
        language: currentSchema.language,
        translations: currentSchema.translations,
        languageFallbacks: currentSchema.languageFallbacks,
      },
      new: {
        language: opts.language,
        translations: opts.translations,
        languageFallbacks: opts.languageFallbacks,
      },
    })
  }

  if (opts.root?.$delete) {
    mutations.push({
      mutation: 'delete_type',
      type: 'root',
    })
  }

  mutations.push(
    ...diffFields(
      'root',
      [],
      currentSchema.root.fields,
      opts.root?.fields || {}
    )
  )

  mutations.push(...diffTypes(currentSchema.types, opts.types || {}))

  return mutations
}
