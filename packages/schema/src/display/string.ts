export const basedSchemaDisplayFormats = [
  'lowercase',
  'uppercase',
  'capitalize',
] as const
export type basedSchemaDisplayFormat =
  (typeof basedSchemaDisplayFormats)[number]
export type StringFormat = basedSchemaDisplayFormat // deprecated

const parseString = (value?: string, format?: StringFormat): string => {
  if (!format) {
    return value
  }

  if (!value) {
    return value
  }

  if (format === 'lowercase') {
    return value.toLowerCase()
  }

  if (format === 'uppercase') {
    return value.toUpperCase()
  }

  if (format === 'capitalize') {
    const a = value[0]
    return a.toUpperCase() + (value ? value.slice(1) : '')
  }

  return value
}

export default parseString
