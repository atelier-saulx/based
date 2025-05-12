import { LANGUAGES } from '../../shared/constants.js'

export const languages: { iso: string; name: string }[] = Object.entries(
  LANGUAGES,
).map(([iso, name]) => {
  return { iso, name }
})
