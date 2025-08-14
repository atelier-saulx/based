// import { ServerClient as PostmarkClient } from 'postmark'
import { BasedFunction, HttpSession, isWsContext } from '@based/functions'
import { passwordResetTemplate } from './passwordReset.js'
import { magicLinkTemplate } from './magicLink.js'
import { inviteTemplate } from './invite.js'
import { createTransport, Transporter } from 'nodemailer'
import type { Opts } from '../../index.js'
// let postMarkClient: PostmarkClient

// const templatePostmarkToken = process.env.TEMPLATE_POSTMARK_TOKEN

type Payload = {
  type: 'invite' | 'passwordReset' | 'magicLink'
  appName: string
  email: string
  callToAction: string
  code?: string
}

let transporter: Transporter

export const authEmail = (smtp: Opts['smtp']): BasedFunction<Payload> => {
  return async (_based, payload, ctx) => {
    transporter ??= createTransport(smtp.auth)
    await transporter.verify()

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

    // if (!postMarkClient) {
    //   if (!templatePostmarkToken) {
    //     throw new Error('TEMPLATE_POSTMARK_TOKEN env not setup')
    //   }
    //   postMarkClient = new PostmarkClient(templatePostmarkToken)
    // }

    if (type === 'passwordReset') {
      return await transporter.sendMail({
        from: 'Based <auth@based.io>',
        to: email,
        subject: `Password reset "${code}"`,
        html: passwordResetTemplate({ appName, code, email, callToAction }),
      })
    } else if (type === 'magicLink') {
      return await transporter.sendMail({
        from: 'Based <auth@based.io>',
        to: email,
        subject: `${appName} login. "${code}"`,
        html: magicLinkTemplate({ appName, code, email, callToAction }),
      })
    } else if (type === 'invite') {
      return await transporter.sendMail({
        from: 'Based <auth@based.io>',
        to: email,
        subject: `${appName} user access . "${code}"`,
        html: inviteTemplate({ appName, code, email, callToAction }),
      })
    }

    throw new Error('type not implemented yet')
  }
}
