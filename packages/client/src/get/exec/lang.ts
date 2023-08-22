import { ExecContext } from '../types'

export function makeLangArg(ctx: ExecContext) {
  const { lang } = ctx

  if (!lang) {
    return ''
  }

  const languages = ctx?.client?.schema?.languages ?? []

  let str = lang
  for (let i = 0; i < languages.length; i++) {
    if (languages[i] === lang) {
      continue
    }

    str += `\n${languages[i]}`
  }

  return str
}
