import { PartialObjectDeep } from 'type-fest/source/partial-deep.js'
import {
  BasedSchemaPartial,
  BasedSchemaType,
  BasedSchemaField,
} from '../types.js'
import { BasedOldSchema, FieldSchema, TypeSchema } from './oldSchemaType.js'

type OldSchema = Partial<BasedOldSchema>

const oldToNewType = {
  id: { type: 'string', format: 'basedId' },
  int: { type: 'integer' },
  url: { type: 'string', format: 'URL' },
  email: { type: 'string', format: 'email' },
  float: { type: 'number' },
  phone: { type: 'string', format: 'mobilePhone' },
  digest: { type: 'string', format: 'strongPassword' },
} as const

const newToOldType = {
  mobilePhone: { type: 'phone' },
  basedId: { type: 'id' },
  integer: { type: 'int' },
  URL: { type: 'url' },
  email: { type: 'email' },
  strongPassword: { type: 'digest' },
} as const

const convertNewToOldMeta = (props) => {
  let meta
  for (const i in props) {
    if (i[0] !== '$') {
      const v = props[i]
      meta ??= {}
      if (i === 'display' && v === 'bytes') {
        meta.format = v
      } else if (i === 'title') {
        meta.name = v
      } else {
        meta[i] = v
      }
    }
  }
  return meta
}

const convertOldToNewMeta = (props) => {
  const meta: any = {}
  for (const i in props) {
    const v = props[i]
    if (i === 'format' && v === 'bytes') {
      meta.display = 'bytes'
    } else if (i === 'name') {
      meta.title = v
    } else {
      meta[i] = v
    }
  }
  return meta
}

const convertNewFieldToOldField = (newField: BasedSchemaField): FieldSchema => {
  // @ts-ignore
  const { type, properties, values, items, ...props } = newField
  const meta = convertNewToOldMeta(props)
  // @ts-ignore
  const overwrite = newToOldType[type] || newToOldType[props.format]
  const oldField: FieldSchema = overwrite
    ? { ...overwrite }
    : {
        type,
      }

  if (meta) {
    oldField.meta = meta
  }
  if (properties) {
    // @ts-ignore
    oldField.properties = {}
    for (const key in properties) {
      // @ts-ignore
      oldField.properties[key] = convertNewFieldToOldField(properties[key])
    }
  }
  if (values) {
    // @ts-ignore
    oldField.values = convertNewFieldToOldField(values)
  }

  if (items) {
    // @ts-ignore
    oldField.items = convertNewFieldToOldField(items)
  }

  return oldField
}

const convertNewTypeToOldType = (
  newType: PartialObjectDeep<BasedSchemaType, {}>
): TypeSchema => {
  const { prefix, fields, ...props } = newType
  const oldType: TypeSchema = {}
  const meta = convertNewToOldMeta(props)
  if (prefix) {
    oldType.prefix = prefix
  }
  if (meta) {
    oldType.meta = meta
  }
  if (fields) {
    oldType.fields = {}
    for (const key in fields) {
      // @ts-ignore
      oldType.fields[key] = convertNewFieldToOldField(fields[key])
    }
  }
  return oldType
}

export const convertNewToOld = (newSchema: BasedSchemaPartial): OldSchema => {
  const { root, types, language, translations, prefixToTypeMapping } = newSchema
  const oldSchema: OldSchema = {}

  if (prefixToTypeMapping) {
    oldSchema.prefixToTypeMapping = prefixToTypeMapping
  }

  if (language) {
    oldSchema.languages = [language]
  }

  if (translations) {
    oldSchema.languages ??= []
    oldSchema.languages.push(...translations)
  }

  if (root) {
    oldSchema.rootType = convertNewTypeToOldType(root)
  }

  if (types) {
    oldSchema.types = {}
    for (const key in types) {
      oldSchema.types[key] = convertNewTypeToOldType(types[key])
    }
  }

  return oldSchema
}

const convertOldFieldToNewField = (oldField: FieldSchema): BasedSchemaField => {
  // @ts-ignore
  const { type, properties, values, items, meta = {} } = oldField
  const overwrite = oldToNewType[type] || oldToNewType[meta.format]
  const newField: BasedSchemaField = overwrite
    ? {
        ...overwrite,
        ...convertOldToNewMeta(meta),
      }
    : {
        type,
        ...convertOldToNewMeta(meta),
      }

  if (properties) {
    // @ts-ignore
    newField.properties = {}
    for (const key in properties) {
      // @ts-ignore
      newField.properties[key] = convertOldFieldToNewField(properties[key])
    }
  }

  if (values) {
    // @ts-ignore
    newField.values = convertOldFieldToNewField(values)
  }

  if (items) {
    // @ts-ignore
    newField.items = convertOldFieldToNewField(items)
  }

  return newField
}

const convertOldTypeToNewType = (oldType: TypeSchema): BasedSchemaType => {
  const { prefix, fields, meta } = oldType
  const newType: BasedSchemaType = {
    fields: {},
  }
  if (prefix) {
    newType.prefix = prefix
  }
  if (meta) {
    Object.assign(newType, convertOldToNewMeta(meta))
  }
  if (fields) {
    for (const key in fields) {
      newType.fields[key] = convertOldFieldToNewField(fields[key])
    }
  }
  return newType
}

export const convertOldToNew = (oldSchema: OldSchema): BasedSchemaPartial => {
  const { rootType, types, languages, prefixToTypeMapping } = oldSchema
  const newSchema: BasedSchemaPartial = {}

  if (prefixToTypeMapping) {
    newSchema.prefixToTypeMapping = prefixToTypeMapping
  }

  if (languages?.length) {
    // @ts-ignore
    newSchema.language = languages[0]
    const translations = languages.slice(1)
    if (translations.length) {
      // @ts-ignore
      newSchema.translations = translations
    }
  }

  if (rootType) {
    newSchema.root = convertOldTypeToNewType(rootType)
  }

  if (types) {
    newSchema.types = {}
    for (const key in types) {
      newSchema.types[key] = convertOldTypeToNewType(types[key])
    }
  }

  return newSchema
}
