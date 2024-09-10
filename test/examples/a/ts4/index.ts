import { BasedAppFunction } from '@based/functions'

export const app: BasedAppFunction = async (
  _based,
  { html, favicon },
  _ctx,
) => {
  return `<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="shortcut icon" href="${favicon.url}"/>
  </head>
  <body>
    <div id="root">${await html.text}</div>
  </body>
</html>`

  //<script src="${js.url}"></script>
}
