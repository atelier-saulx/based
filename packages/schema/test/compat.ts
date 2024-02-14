import test from 'ava'
import { newSchemas } from './data/newSchemas.js'
import { oldSchemas } from './data/oldSchemas.js'
import {
  convertNewToOld,
  convertOldToNew,
  validateSchema,
} from '../src/index.js'

const addStandardMetaToOld = (obj) => {
  if (obj && typeof obj === 'object') {
    if (obj.type === 'id') {
      obj.meta ??= {}
      obj.meta.format = 'basedId'
    } else if (obj.type === 'email') {
      obj.meta ??= {}
      obj.meta.format = 'email'
    } else if (obj.type === 'digest') {
      obj.meta ??= {}
      obj.meta.format = 'strongPassword'
    } else if (obj.type === 'url') {
      obj.meta ??= {}
      obj.meta.format = 'URL'
    } else if (obj.type === 'phone') {
      obj.meta ??= {}
      obj.meta.format = 'mobilePhone'
    }
    for (const i in obj) {
      addStandardMetaToOld(obj[i])
    }
  }
}

test('refTypes', async (t) => {
  const newSchema = convertOldToNew({
    types: {
      youzi: {
        fields: {
          image: {
            type: 'reference',
            meta: {
              refTypes: ['youzi'],
            },
          },
        },
      },
    },
  })

  // @ts-ignore
  t.is(newSchema.types.youzi.fields.image.allowedTypes[0], 'youzi')

  const oldSchema = convertNewToOld(newSchema)

  // @ts-ignore
  t.is(oldSchema.types.youzi.fields.image.meta.refTypes[0], 'youzi')
})

test('old schema compat mode', async (t) => {
  for (let i = 0; i < oldSchemas.length - 1; i++) {
    const oldSchema = oldSchemas[i]
    const newSchema = convertOldToNew(oldSchema)
    const validation = await validateSchema(newSchema)
    t.true(validation.valid)
    addStandardMetaToOld(oldSchema)
    t.deepEqual(
      oldSchema,
      convertNewToOld(newSchema),
      `Schema conversion oldSchemas index ${i}`
    )
  }
})

test('new schema compat mode', async (t) => {
  for (let i = 0; i < newSchemas.length - 1; i++) {
    const newSchema = newSchemas[i]
    const validation = await validateSchema(newSchema)
    const oldSchema = convertNewToOld(newSchema)

    t.true(validation.valid)

    t.deepEqual(
      newSchema,
      convertOldToNew(oldSchema),
      `Schema conversion newSchemas index ${i}`
    )
  }
})
