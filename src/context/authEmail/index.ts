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
      TextBody: `${appName}
Password reset request
Hello ${email},

We’ve received password reset resquest for the following app: ${appName}

${code}

To reset your password, please click use the link below:

${callToAction}

Please ignore this email if you didn’t request a password reset for this application.

`,
    })
  } else if (type === 'magicLink') {
    return await postMarkClient.sendEmail({
      From: 'Based <auth@based.io>',
      To: email,
      Subject: `${appName} login. "${code}"`,
      HtmlBody: magicLinkTemplate({ appName, code, email, callToAction }),
      TextBody: `${appName}
Log in to your account
Hey there, 
We've just received a login attempt to ${email}, with the following code: ${code}

To log in, please use the url below & make sure you see the same code on the login page.
${callToAction}

If you didn’t attempt to log in, you can ignore this email. Your account is safe.`,
    })
  } else if (type === 'invite') {
    return await postMarkClient.sendEmail({
      From: 'Based <auth@based.io>',
      To: email,
      Subject: `${appName} user access.`,
      HtmlBody: inviteTemplate({ appName, email, callToAction }),
      TextBody: `${appName}
User access
Hello ${email},

You've been granted access to the ${appName} application.
Please use the link below to accept the invite.

${callToAction}

Please ignore this email if you didn’t request access to this application.`,
    })
  }

  throw new Error('type not implemented yet')
}
