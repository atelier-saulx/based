import { Params } from '@based/server'
import getService from '@based/get-service'

export default async ({ based, payload }: Params) => {
  const { t: resetToken } = payload

  if (!resetToken) {
    throw new Error('Invalid request')
  }

  const user = await based.get({
    $alias: resetToken,
    id: true,
  })

  if (!user?.id) {
    throw new Error('Invalid reset request. Already reset?')
  }

  const service = await getService({
    org: based.opts.org,
    project: based.opts.project,
    env: based.opts.env,
    name: '@based/hub',
  })

  const actionUrl = `${service.url.replace('ws', 'http')}/call/resetPassword?`

  return `<html>
  <head>
    <script>
        window.reset = (e) => {
          const password = document.getElementById('pa').value
          const cpassword = document.getElementById('pac').value
          if (password === cpassword) {
            fetch(\`${actionUrl}q=\${encodeURI(JSON.stringify({ t: "${resetToken}", p: password }))}\`)
          }
        }
    </script>
  </head>
  <body>
  <div>
    <form onsubmit="">
      <label>Password: <input id="pa" name="password" type="password" /></label>
      <label>Confirm Password: <input id="pac" name="confirmPassword" type="confirmPassword" /></label>
      <button type="submit">Submit</button>
    </form>
  </div>
  </body>
  </html>`
}

export const headers = async () => {
  return { 'Content-Type': 'text/html' }
}
