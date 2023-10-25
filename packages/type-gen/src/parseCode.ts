const babelParser = require('@babel/parser')
const traverse = require('@babel/traverse').default

const parseCode = (
  code: string
): {
  input: any[]
  output: any[]
} => {
  const result = {
    input: [],
    output: [],
  }

  const ast = babelParser.parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  })
  const p = []
  const identifiers = {}

  console.dir(ast, { depth: 1000 })

  try {
    traverse(ast, {
      Identifier(p) {
        console.info(p)

        identifiers[p.node.name] = p
      },
      TSTypeAliasDeclaration: function (path) {
        if (path.node.id?.name?.includes('Props') && path.node.typeAnnotation) {
          const type = path.node.typeAnnotation

          if (type.members) {
          } else if (type.type === 'TSUnionType') {
            // console.info('?', path.node, type.types)
            // p.push(props)
          }
        }
      },
    })
  } catch (err) {
    console.error(err)
  }
  return result
}

/*
  import type helloWorld from '../../helloWorld'
  
  // this to an overload for basedClient
*/
