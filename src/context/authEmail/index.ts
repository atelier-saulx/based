import { ServerClient as PostmarkClient } from 'postmark'
import { BasedFunction, HttpSession, isWsContext } from '@based/functions'
import { passwordResetTemplate } from './passwordReset.js'
import { magicLinkTemplate } from './magicLink.js'
import { inviteTemplate } from './invite.js'

let postMarkClient: PostmarkClient

const templatePostmarkToken = process.env.TEMPLATE_POSTMARK_TOKEN

type Payload = {
  type: 'invite' | 'passwordReset' | 'magicLink'
  appName: string
  email: string
  callToAction: string
  code?: string
}

export const authEmail: BasedFunction<Payload> = async (
  _based,
  payload,
  ctx,
) => {
  if ((ctx.session as HttpSession).method) {
    throw new Error('Disabled')
  }

  if (!payload?.email) {
    throw new Error('Payload must contain "email" property')
  }
  if (!payload?.email) {
    throw new Error('Payload must contain "email" property')
  }
  if (!payload?.appName) {
    throw new Error('Payload must contain "appName" property')
  }
  if (!payload?.callToAction) {
    throw new Error('Payload must contain "callToAction" property')
  }

  let { type, appName, email, callToAction, code } = payload

  if (!appName) {
    appName = 'appName here'
  }
  if (!code) {
    code = 'code here'
  }

  if (!postMarkClient) {
    if (!templatePostmarkToken) {
      throw new Error('TEMPLATE_POSTMARK_TOKEN env not setup')
    }
    postMarkClient = new PostmarkClient(templatePostmarkToken)
  }

  if (type === 'passwordReset') {
    return await postMarkClient.sendEmail({
      From: 'Based <auth@based.io>',
      To: email,
      Subject: `Password reset "${code}"`,
      HtmlBody: passwordResetTemplate({ appName, code, email, callToAction }),
    })
  } else if (type === 'magicLink') {
    return await postMarkClient.sendEmail({
      From: 'Based <auth@based.io>',
      To: email,
      Subject: `${appName} login. "${code}"`,
      HtmlBody: magicLinkTemplate({ appName, code, email, callToAction }),
    })
  } else if (type === 'invite') {
    return await postMarkClient.sendEmail({
      From: 'Based <auth@based.io>',
      To: email,
      Subject: `${appName} user access . "${code}"`,
      HtmlBody: inviteTemplate({ appName, code, email, callToAction }),
    })
  }

  throw new Error('type not implemented yet')
}
