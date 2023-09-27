export default async (based, { css, js }) => {
  return `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, height=device-height, initial-scale=1.0, minimum-scale=1.0, viewport-fit=cover"
        />
        <title>Front End App</title>
        <style>
          ${await css.text}
        </style>
      </head>
      <body>
        <script>window.basedConfig=${JSON.stringify({
          env: process.env.ENV,
          project: process.env.PROJECT,
          org: process.env.ORG,
          cluster: process.env.CLUSTER,
        })}</script>
        <div id="root"></div>
        <script>
          ${await js.text}
        </script>
      </body>
    </html>`
}
