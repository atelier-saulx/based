import type { BasedAppFunction } from '@based/functions'

export default (async (_based, { js, css }) => {
  return `<!DOCTYPE html>
  <html>
    <head>
      <title>Based App</title>
      <link rel="stylesheet" href="${css.url}">
    </head>
    <body style="margin:0;padding:0">
      <div id="root"></div>
      <div id="portal"></div>
      <script src="${js.url}"></script>
    </body>
  </html>`
}) as BasedAppFunction
