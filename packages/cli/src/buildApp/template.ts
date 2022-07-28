import files from './files.json'
import fileHeaders from './headers.json'
import { css, js } from './paths.json'

export default async function app({ based, payload, path }) {
  if (path in files) {
    return files[path]
  }
  return `<html>
  <head>
    <meta charset="UTF-8" />
    ${js.map((path) => `<script src="${path}"/>`)}
  </head>
  <body>
  ${js.map((path) => `<script src="${path}"/>`)}
  </body>
</html>`
}

export const headers = async ({ path }) => {
  const headers = fileHeaders[path] || { 'Content-Type': 'text/html' }

  return {
    ...headers,
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=300, immutable',
  }
}
