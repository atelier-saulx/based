export default async (_based, { css, js, favicon }) => {
  return `<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="shortcut icon" href="${favicon.url}"/>
    <link rel="stylesheet" href="${css.url}" />
  </head>
  <body>
    <div id="root"></div>
    <script src="${js.url}"></script>
  </body>
</html>`
}
