export const isSchemaFile = (file) =>
  file === 'based.schema.js' ||
  file === 'based.schema.json' ||
  file === 'based.schema.ts'

export const isConfigFile = (file) =>
  file === 'based.config.js' ||
  file === 'based.config.json' ||
  file === 'based.config.ts'

export const isIndexFile = (file) => file === 'index.ts' || file === 'index.js'
