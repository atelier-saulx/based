import files from './files.json'
import fileHeaders from './headers.json'
import { css, js } from './paths.json'

export default async function app({ based, payload, path }) {
  if (path in files) {
    return Buffer.from(files[path], 'base64')
  }
  return `<html>
  <head>
    <meta charset="UTF-8" />
    ${css.map((path) => `<link rel="stylesheet" href="${path}">`).join('')}
  </head>
  <body>
    ${js.map((path) => `<script src="${path}"></script>`).join('')}
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
