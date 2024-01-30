import anyTest, { TestFn } from 'ava'
import { validateSchema } from '../../src/validateSchema/index.js'
import { ParseError } from '../../src/error.js'

const test = anyTest as TestFn<{}>

test('should not allow non object schemas', async (t) => {
  t.deepEqual(await validateSchema(undefined), {
    errors: [{ code: ParseError.invalidSchemaFormat }],
  })
  t.deepEqual(await validateSchema(null), {
    errors: [{ code: ParseError.invalidSchemaFormat }],
  })
  // @ts-ignore
  t.deepEqual(await validateSchema('this is a string'), {
    errors: [{ code: ParseError.invalidSchemaFormat }],
  })
  // @ts-ignore
  t.deepEqual(await validateSchema(1), {
    errors: [{ code: ParseError.invalidSchemaFormat }],
  })
})

test('`languages` property', async (t) => {
  t.deepEqual(await validateSchema({ language: 'en' }), {
    valid: true,
  })
  // @ts-ignore
  t.deepEqual(await validateSchema({ language: 'xx' }), {
    errors: [{ code: ParseError.languageNotSupported, path: ['language'] }],
  })
})

test('`translations` property', async (t) => {
  t.deepEqual(
    await validateSchema({
      language: 'en',
      translations: ['fr', 'pt'],
    }),
    {
      valid: true,
    }
  )
  t.deepEqual(
    await validateSchema({
      language: 'en',
      // @ts-ignore
      translations: 'de',
    }),
    {
      errors: [{ code: ParseError.incorrectFormat, path: ['translations'] }],
    }
  )
  t.deepEqual(
    await validateSchema({
      language: 'en',
      // @ts-ignore
      translations: ['pt', 'xx'],
    }),
    {
      errors: [
        { code: ParseError.languageNotSupported, path: ['translations'] },
      ],
    }
  )
})

test('`languageFallbacks` property', async (t) => {
  t.deepEqual(
    await validateSchema({
      language: 'en',
      translations: ['fr', 'pt'],
      languageFallbacks: {
        fr: ['en'],
        pt: ['fr', 'pt'],
      },
    }),
    {
      valid: true,
    }
  )

  t.deepEqual(
    await validateSchema({
      language: 'en',
      translations: ['fr', 'pt'],
      // @ts-ignore
      languageFallbacks: 'pt',
    }),
    {
      errors: [
        { code: ParseError.incorrectFormat, path: ['languageFallbacks'] },
      ],
    }
  )

  t.deepEqual(
    await validateSchema({
      language: 'en',
      translations: ['fr', 'pt'],
      // @ts-ignore
      languageFallbacks: ['pt'],
    }),
    {
      errors: [
        { code: ParseError.incorrectFormat, path: ['languageFallbacks'] },
      ],
    }
  )

  t.deepEqual(
    await validateSchema({
      language: 'en',
      translations: ['fr', 'pt'],
      languageFallbacks: {
        fr: ['en'],
        // @ts-ignore
        pt: ['xx', 'pt'],
      },
    }),
    {
      errors: [
        { code: ParseError.noLanguageFound, path: ['languageFallbacks'] },
      ],
    }
  )

  t.deepEqual(
    await validateSchema({
      language: 'en',
      translations: ['fr', 'pt'],
      languageFallbacks: {
        // @ts-ignore
        fr: 'en',
      },
    }),
    {
      errors: [
        { code: ParseError.incorrectFormat, path: ['languageFallbacks'] },
      ],
    }
  )

  t.deepEqual(
    await validateSchema({
      language: 'en',
      translations: ['fr', 'pt'],
      languageFallbacks: {
        fr: ['en'],
        // @ts-ignore
        xx: ['fr', 'pt'],
      },
    }),
    {
      errors: [
        { code: ParseError.noLanguageFound, path: ['languageFallbacks'] },
      ],
    }
  )
})
