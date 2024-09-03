export default async (_based, { css, js, favicon }, _ctx) => {
  return `<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="shortcut icon" href="${favicon.url}"/>
    <link rel="stylesheet" href="${css.url}" />
  </head>
  <body>
    <div id="root"></div>
    <script>${await js.text}</script>
  </body>
</html>`

  //<script src="${js.url}"></script>
}
