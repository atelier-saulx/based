import { ExecContext } from '../types.js'

export function makeLangArg(ctx: ExecContext) {
  const { lang } = ctx

  if (!lang) {
    return ''
  }

  const fallbacks = ctx?.client?.schema?.languageFallbacks ?? {}
  const primaryLanguage = ctx?.client?.schema?.language ?? 'en'
  const languages = fallbacks[lang] ?? [primaryLanguage]

  let str = lang
  for (let i = 0; i < languages.length; i++) {
    if (languages[i] === lang) {
      continue
    }

    str += `\n${languages[i]}`
  }

  return str
}
