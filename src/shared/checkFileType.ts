export const isSchemaFile = (file: string) =>
  file === 'based.schema.js' ||
  file === 'based.schema.json' ||
  file === 'based.schema.ts'

export const isConfigFile = (file: string) =>
  file === 'based.config.js' ||
  file === 'based.config.json' ||
  file === 'based.config.ts'

export const isIndexFile = (file: string) =>
  file === 'index.ts' || file === 'index.js'
