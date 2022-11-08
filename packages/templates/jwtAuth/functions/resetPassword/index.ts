import { Params } from '@based/server'

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
    return { status: 'ok' }
  }

  await based.set({
    $id: user.id,
    aliases: { $delete: resetToken },
    status: { $delete: true },
  })

  return { status: 'ok' }
}
