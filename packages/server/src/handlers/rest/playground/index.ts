import uws from '@based/uws'
import { BasedServer } from '../../..'
import invalidReq from '../invalidReq'
import readBody from '../readBody'
import { graphql, validate, parse, buildSchema, DocumentNode } from 'graphql'
import {
  BasedGraphQL,
  createOperations,
  genSchema,
  handleGraphqlVariables,
} from '@based/graphql'
import { deepCopy } from '@saulx/utils'
import { getFunction } from '../../../getFromConfig'
import { Client } from '../../../types'
import { Params } from '../../../Params'

function tweakTypeName(obj: any): void {
  if (typeof obj !== 'object') {
    return
  }

  if (Array.isArray(obj)) {
    if (typeof obj[0] === 'object') {
      for (const entry of obj) {
        tweakTypeName(entry)
      }
    } else {
      return
    }
  }

  for (const key in obj) {
    if (key === '__typename') {
      obj[key] = obj[key][0].toUpperCase() + obj[key].slice(1)
      continue
    }

    tweakTypeName(obj[key])
  }
}

async function runGraphql(
  server: BasedServer,
  client: Client,
  db: string,
  variables: any,
  graphqlAst: DocumentNode
) {
  try {
    let op: BasedGraphQL = createOperations(
      { schemas: server.db.schemas, db },
      graphqlAst
    )
    op = handleGraphqlVariables(op, op, variables)

    const fnsResults: Record<string, any> = {}
    if (op.opType === 'GET') {
      const queryObj: any = { $db: op.db }
      for (const key in op.ops) {
        // TODO
        if (op.ops[key].fnObserve) {
          try {
            const resp = await server.based.get(
              <string>op.ops[key].fnObserve.name,
              op.ops[key].fnObserve.payload
            )

            if (resp) {
              // queryObj[key] = { $value: resp }
              fnsResults[key] = resp
            }
          } catch (e) {
            console.error('WHAAAAT', e)
          }
          continue
        }

        if (op.ops[key].get) {
          queryObj[key] = op.ops[key].get
        }
      }

      const data = await server.db.get(queryObj)
      tweakTypeName(data)

      // function results
      for (const key in fnsResults) {
        data[key] = fnsResults[key]
      }

      return { data }
    }

    const reply = {}
    await Promise.all(
      Object.entries(op.ops).map(async ([k, op]) => {
        if (op.delete) {
          reply[k] = await server.db.delete(op.delete)
          return
        } else if (op.fnCall) {
          const name = <string>op.fnCall.name
          const fn = await getFunction(server, name)
          if (!fn || fn.observable) {
            return
          }

          const params = new Params(server, op.fnCall.payload, client, [name])
          const result = await fn.function(params)
          reply[k] = result

          return
        }

        const id = await server.db.set(op.set)
        if (!op.get) {
          const o: any = {}
          o.id = id

          const type =
            server.db.schemas?.[db]?.prefixToTypeMapping?.[id.slice(0, 2)]
          if (type) {
            o.type = type
          }

          reply[k] = o
          return
        }

        const getOpts: any = deepCopy(op.get)
        getOpts.$id = id

        const getData = await server.db.get(getOpts)
        tweakTypeName(getData)
        reply[k] = getData
      })
    )

    return { data: reply }
  } catch (e) {
    return { errors: [{ message: e.message, locations: e.locations }] }
  }
}

export default async (
  server: BasedServer,
  client: Client,
  req: uws.HttpRequest,
  res: uws.HttpResponse,
  url: string
) => {
  res.writeHeader('Access-Control-Allow-Origin', '*')

  res.writeHeader(
    'Access-Control-Allow-Headers',
    'File-Extension, File-Name, File-Id, Function-Name, Content-Length, File-Is-Raw, Content-Type, Authorization'
  )

  const method = req.getMethod()
  const db = req.getQuery('db') || 'default'

  if (method === 'get') {
    res.writeHeader('content-type', 'text/html')
    res.end(playgroundSource)
    return
  }

  if (method !== 'post') {
    return invalidReq(res)
  }

  let type = req.getHeader('content-type')

  let schema = server.db.schemas[db]
  if (!schema) {
    schema = (await server.db.getSchema(db)).schema
  }

  readBody(res, type, (body) => {
    res.writeHeader('content-type', 'application/json')

    if (typeof body !== 'object') {
      return invalidReq(res)
    }

    if (!body?.query) {
      return invalidReq(res)
    }

    if (body?.operationName === 'IntrospectionQuery') {
      Promise.all([server.db.getSchema(db), server.based.get('$configuration')])
        .then(([schemaResp, cfg]) => {
          const gqlSchema = genSchema(schemaResp.schema, cfg?.functions)

          console.info(gqlSchema)

          const typeDefs = buildSchema(gqlSchema)
          return graphql({ schema: typeDefs, source: body.query })
        })
        .then((result) => {
          if (result) {
            res.end(JSON.stringify(result))
          } else {
            res.end('{}')
          }
        })
        .catch((e) => {
          console.error('Introspection error', e)
          return invalidReq(res)
        })

      return
    }

    const graphqlAst = parse(body.query)
    const variables = body?.variables

    Promise.all([server.db.getSchema(db), server.based.get('$configuration')])
      .then(([resp, cfg]) => {
        const gqlSchema = genSchema(resp.schema, cfg?.functions)
        const typeDefs = buildSchema(gqlSchema)

        const errors = validate(typeDefs, graphqlAst)

        if (errors.length) {
          res.end(
            JSON.stringify({
              errors,
            })
          )
          return
        }

        return runGraphql(server, client, db, variables, graphqlAst)
      })
      .then((resp) => {
        res.end(JSON.stringify(resp))
      })
      .catch((e) => {
        console.error('Playground error', e)
        return invalidReq(res)
      })
  })
}

const playgroundSource = `
<!doctype html><html><head><style>body {
        height: 100%;
        margin: 0;
        width: 100%;
        overflow: hidden;
      }
      #graphiql {
        height: 100vh;
      }</style><script crossorigin src="https://unpkg.com/react@16/umd/react.development.js"></script><script crossorigin src="https://unpkg.com/react-dom@16/umd/react-dom.development.js"></script><link href="https://unpkg.com/graphiql/graphiql.min.css" rel="stylesheet" /><script crossorigin src="https://unpkg.com/graphiql/graphiql.min.js"></script></script></head><body><div id="graphiql">Loading...</div><script defer="defer">
/**
 * UMD GraphiQL Example
 *
 * This is a simple example that provides a primitive query string parser on top of GraphiQL props
 * It assumes a global umd GraphiQL, which would be provided by an index.html in the default example
 *
 * It is used by:
 * - the netlify demo
 * - end to end tests
 * - webpack dev server
 */

// Parse the search string to get url parameters.
var search = window.location.search;
var parameters = {};
search
  .substr(1)
  .split('&')
  .forEach(function (entry) {
    var eq = entry.indexOf('=');
    if (eq >= 0) {
      parameters[decodeURIComponent(entry.slice(0, eq))] = decodeURIComponent(
        entry.slice(eq + 1),
      );
    }
  });

// If variables was provided, try to format it.
if (parameters.variables) {
  try {
    parameters.variables = JSON.stringify(
      JSON.parse(parameters.variables),
      null,
      2,
    );
  } catch (e) {
    // Do nothing, we want to display the invalid JSON as a string, rather
    // than present an error.
  }
}

// If headers was provided, try to format it.
if (parameters.headers) {
  try {
    parameters.headers = JSON.stringify(
      JSON.parse(parameters.headers),
      null,
      2,
    );
  } catch (e) {
    // Do nothing, we want to display the invalid JSON as a string, rather
    // than present an error.
  }
}

// When the query and variables string is edited, update the URL bar so
// that it can be easily shared.
function onEditQuery(newQuery) {
  parameters.query = newQuery;
  updateURL();
}

function onEditVariables(newVariables) {
  parameters.variables = newVariables;
  updateURL();
}

function onEditHeaders(newHeaders) {
  parameters.headers = newHeaders;
  updateURL();
}

function onEditOperationName(newOperationName) {
  parameters.operationName = newOperationName;
  updateURL();
}

function updateURL() {
  var newSearch =
    '?' +
    Object.keys(parameters)
      .filter(function (key) {
        return Boolean(parameters[key]);
      })
      .map(function (key) {
        return (
          encodeURIComponent(key) + '=' + encodeURIComponent(parameters[key])
        );
      })
      .join('&');
  history.replaceState(null, null, newSearch);
}

const api = '/playground' 

// Render <GraphiQL /> into the body.
// See the README in the top level of this module to learn more about
// how you can customize GraphiQL by providing different values or
// additional child elements.
ReactDOM.render(
  React.createElement(GraphiQL, {
    fetcher: GraphiQL.createFetcher({ url: api }),
    query: parameters.query,
    variables: parameters.variables,
    headers: parameters.headers,
    operationName: parameters.operationName,
    onEditQuery: onEditQuery,
    onEditVariables: onEditVariables,
    onEditHeaders: onEditHeaders,
    defaultSecondaryEditorOpen: true,
    onEditOperationName: onEditOperationName,
    headerEditorEnabled: true,
    shouldPersistHeaders: true,
  }),
  document.getElementById('graphiql'),
);
          </script></body></html>    `
