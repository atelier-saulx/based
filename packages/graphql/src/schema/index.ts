import generateMutations from './mutation'
import generateQuery from './query'

const allField = `_all: BasedOperator
_value(v: JSON!): JSON!
_aggregate(edgeField: String!, function: AggregateFunction!, args: [JSON!], filter: Filter): Float
_inherit(type: [NodeType]): JSON
_inheritItem: Node!
`

const nodeFields = `id: ID!
  type: String!
  
  aliases: [String!]

  parents(filter: Filter, sortBy: SortBy, recursive: Boolean): [Node!]
  children(filter: Filter, sortBy: SortBy, recursive: Boolean): [Node!]
  
  ancestors(filter: Filter, sortBy: SortBy): [Node!]
  descendants(filter: Filter, sortBy: SortBy): [Node!]
  ${allField}`

const nodeInputFields = `aliases: StringSetInput
  parents: ReferencesInput
  children: ReferencesInput`

const FIELD_TYPES = {
  id: 'ID!',
  type: 'String!',
  int: 'Int',
  timestamp: 'Int',
  float: 'Float',
  number: 'Float',
  string: 'String',
  email: 'String',
  phone: 'String',
  digest: 'String',
  url: 'String',
  boolean: 'Boolean',
  reference: 'Node',
  references: '[Node!]',
  text: 'Language',
  json: 'JSON',
}

const INPUT_FIELD_TYPES = {
  ...FIELD_TYPES,
  text: 'LanguageInput',
  reference: 'ID',
  references: 'ReferencesInput',
}

const DEFAULT_FIELDS = new Set([
  'id',
  'type',
  'aliases',
  'parents',
  'children',
  'ancestors',
  'descendants',
])

function compileLanguageType(languages: string[]): string {
  if (!languages?.length) {
    languages = ['en']
  }

  const fields = languages
    .map((l) => {
      return `  ${l}: String`
    })
    .join('\n')
  const typeDef = `
type Language {
${fields}
}

input LanguageInput {
${fields}
}
`

  return typeDef
}

function setTypeToGraphQL(setType: any): string {
  if (['object', 'record', 'json'].includes(setType.items.type)) {
    return 'JSON'
  }

  return FIELD_TYPES[setType.items.type]
}

function compileType(
  schema: any,
  typeName: string,
  fields: Record<string, any>,
  isNodeType: boolean = true
): string {
  typeName = typeName[0].toUpperCase() + typeName.slice(1)

  const refFields = new Set(isNodeType ? ['children', 'parents'] : [])
  let nestedTypes = ''
  let typeFields = ''
  let inputTypeFields = ''
  for (const fieldName in fields) {
    if (isNodeType && DEFAULT_FIELDS.has(fieldName)) {
      continue
    }

    const field = fields[fieldName]

    typeFields += '\n  '
    inputTypeFields += '\n  '
    if (field.type === 'object') {
      const fieldNameCamel = fieldName[0].toUpperCase() + fieldName.slice(1)
      const fieldTypeName = `${typeName}${fieldNameCamel}`

      nestedTypes += compileType(schema, fieldTypeName, field.properties, false)

      typeFields += `${fieldName}: ${fieldTypeName}`
      inputTypeFields += `${fieldName}: ${fieldTypeName}Input`

      nestedTypes += compileTimeseriesType(typeName, field, fieldTypeName)
    } else if (field.type === 'record') {
      // FIXME: why... still to this day this sucks
      typeFields += `${fieldName}: JSON`
      inputTypeFields += `${fieldName}: JSON`

      nestedTypes += compileTimeseriesType(typeName, field, 'JSON')
    } else if (field.type === 'array') {
      // FIXME: why... still to this day this sucks
      typeFields += `${fieldName}: [JSON]`
      inputTypeFields += `${fieldName}: [JSON]`

      nestedTypes += compileTimeseriesType(typeName, field, '[JSON]')
    } else if (field.type === 'set') {
      typeFields += `${fieldName}: [${setTypeToGraphQL(field)}!]`
      inputTypeFields += `${fieldName}: [${setTypeToGraphQL(field)}!]`

      nestedTypes += compileTimeseriesType(
        typeName,
        field,
        `[${setTypeToGraphQL(field)}!]`
      )
    } else if (field.type === 'references') {
      refFields.add(fieldName)
      const type = FIELD_TYPES.references
      const inputType = INPUT_FIELD_TYPES[field.type]
      typeFields += `${fieldName}(filter: Filter, sortBy: SortBy, recursive: Boolean): ${type}`
      inputTypeFields += `${fieldName}: ${inputType}`

      nestedTypes += compileTimeseriesType(typeName, field, type)
    } else {
      const type = FIELD_TYPES[field.type]
      const inputType = INPUT_FIELD_TYPES[field.type]
      typeFields += `${fieldName}: ${type}`
      inputTypeFields += `${fieldName}: ${inputType}`

      nestedTypes += compileTimeseriesType(typeName, field, type)
    }

    // @ts-ignore
    if (field.timeseries) {
      // TODO: add _revisions_${fieldName} to the type fields also
    }
  }

  let traverseByTypeDef = ''
  if (refFields.size) {
    traverseByTypeDef += `enum ${typeName}TraverseByTypeFields {`

    for (const f of refFields) {
      traverseByTypeDef += `  ${f}\n`
    }

    traverseByTypeDef += '}\n\n'

    // FIXME: this is too simple?
    traverseByTypeDef += `input ${typeName}TraverseByTypeExpression {
  all: [${typeName}TraverseByTypeFields!]  
  first: [${typeName}TraverseByTypeFields!]  
}
`
  }

  const typeDef = `
${nestedTypes}
type ${typeName}${isNodeType ? ' implements Node' : ''} {
  ${isNodeType ? nodeFields : allField}

  ${
    refFields.size
      ? `_traverse(traverse: TraverseByType, filter: Filter, sortBy: SortBy, recursive: Boolean = false): [Node!]`
      : ''
  }

  ${typeFields.slice(3)}
}
`

  const inputDef = `
input ${typeName}Input {
  ${isNodeType ? nodeInputFields : ''}
  ${inputTypeFields.slice(3)}
}
`

  return traverseByTypeDef + typeDef + inputDef
}

function compileTimeseriesType(
  typeName: string,
  field: any,
  graphqlType: string
): string {
  // @ts-ignore
  if (!field.timeseries) {
    return ''
  }

  console.log('YES HAS TIMESERIES', typeName, field, graphqlType)
  // TODO
}

function generateNodeInterface(): string {
  const nodeInterface = `
interface Node {
  ${nodeFields}
}
`

  return nodeInterface
}

function generateSharedInputs(schema): string {
  // TODO: probably at LTE and GTE filters (and support in selva)
  let sharedInputs = `
enum AggregateFunction {
  SUM
  AVG
  COUNT
}

enum FilterOperation {
  EQ
  NEQ
  LT
  GT
  EXISTS
  NOT_EXISTS
  HAS
}

enum SortByOrder {
  DESC
  ASC
}

input SortBy {
  field: String!
  order: SortByOrder
}

input Filter {
  op: FilterOperation!
  field: String!
  value: JSON!
  and: Filter
  or: Filter
}

enum ReferencesInputOperation {
  ADD
  REMOVE
  SET
}

input ReferencesInput {
  op: ReferencesInputOperation,
  ids: [ID!]
}

enum SetInputOperation {
  ADD
  REMOVE
  SET
}

input AnyTraverseByTypeExpression {
  all: [String!]  
  first: [String!]  
}
`

  const allowedSetTypes = ['String', 'Int', 'JSON', 'Float']
  for (const type of allowedSetTypes) {
    sharedInputs += `
input ${type}SetInput {
  op: SetInputOperation,
  values: [${type}!]
}
`
  }

  sharedInputs += 'input TraverseByType {\n'
  for (const t in schema.types) {
    const tName = t[0].toUpperCase() + t.slice(1)
    sharedInputs += `  ${t}: ${tName}TraverseByTypeExpression\n`
  }
  sharedInputs += '  _any: AnyTraverseByTypeExpression\n'
  sharedInputs += '}\n'

  sharedInputs += 'enum NodeType {\n'
  sharedInputs += '  root'
  for (const t in schema.types) {
    sharedInputs += `  ${t}`
  }
  sharedInputs += '}\n'

  return sharedInputs
}

export default function compileSchema(schema: any): string {
  let output = ''

  output += 'scalar JSON\n'
  output += 'scalar BasedOperator\n'
  output += 'directive @default(value: JSON!) on FIELD\n'
  output += 'directive @inherit(type: [NodeType]) on FIELD\n'
  output += compileLanguageType(schema?.languages)
  output += generateNodeInterface()
  output += generateSharedInputs(schema)

  output += compileType(schema, 'root', schema.rootType.fields)

  for (const typeName in schema.types) {
    const type = schema.types[typeName]
    output += compileType(schema, typeName, type.fields)
  }

  output += '\n'
  output += generateMutations(schema)

  output += '\n'
  output += generateQuery(schema)

  return output
  // return format(output, { parser: 'graphql' })
}
