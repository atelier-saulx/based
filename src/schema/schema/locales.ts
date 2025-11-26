import { LangCode } from '../../zigTsExports.js'
import { assert, isBoolean, isRecord, type RequiredIfStrict } from './shared.js'
type LangName = keyof typeof LangCode

export type SchemaLocale<strict = false> = RequiredIfStrict<
  {
    fallback: LangName[]
  },
  strict
>

export type SchemaLocales<strict = false> = strict extends true
  ? Partial<Record<LangName, SchemaLocale<true>>>
  : LangName[] | Partial<Record<LangName, true | SchemaLocale<false>>>

export const parseLocales = (def: unknown): SchemaLocales<true> => {
  if (def === undefined) {
    return {}
  }

  if (Array.isArray(def)) {
    assert(
      def.every((lang) => lang in LangCode),
      'Should have valid lang codes',
    )
    return Object.fromEntries(def.map((lang) => [lang, { fallback: [] }]))
  }

  assert(isRecord(def), 'Locales should be array or record')

  const locales = {}
  for (const lang in def) {
    const val = def[lang]
    if (val === true) {
      locales[lang] = {
        fallback: [],
      }
    } else {
      assert(isRecord(val), 'Locale should be true or object')
      assert(
        val.fallback === undefined ||
          (Array.isArray(val.fallback) &&
            val.fallback.every((lang) => lang in LangCode)),
        'Fallback should be array of valid lang codes',
      )
      locales[lang] = {
        fallback: val.fallback || [],
      }
    }
  }

  return locales
}
