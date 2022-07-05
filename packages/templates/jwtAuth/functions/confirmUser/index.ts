import { Params } from '@based/server'

export default async ({ based, payload }: Params) => {
  const { c: confirmToken, r: redirectUrl } = payload

  if (!confirmToken || !redirectUrl) {
    throw new Error('Invalid request')
  }

  const user = await based.get({
    $alias: confirmToken,
    id: true,
  })

  if (!user?.id) {
    throw new Error('Confirmation not found. Already confirmed?')
  }

  await based.set({
    $id: user.id,
    aliases: { $delete: confirmToken },
    status: 'confirmedEmail',
  })

  return `
  <html>
    <head>
      <meta charset="UTF-8" />
    </head>
    <body>
      <div>Thanks for confirming the email 🤪!</div>
    </body>
  </html>`
}

export const headers = async () => {
  return { 'Content-Type': 'text/html' }
}
