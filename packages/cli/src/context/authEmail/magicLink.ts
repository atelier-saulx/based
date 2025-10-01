export const magicLinkTemplate = ({
  appName,
  email,
  code,
  callToAction,
}: {
  appName: string
  email: string
  code: string
  callToAction: string
}) => `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <title></title>
  <style type="text/css" rel="stylesheet" media="all">
    /* Base ------------------------------ */
    @import url('https://fonts.googleapis.com/css2?family=Geist+Mono:wght@100..900&family=Geist:wght@100..900&display=swap');

    body {
      width: 100% !important;
      height: 100%;
      margin: 0;
      -webkit-text-size-adjust: none;
    }

    a {
      color: #3869D4;
    }

    a img {
      border: none;
    }

    td {
      word-break: break-word;
    }

    .preheader {
      display: none !important;
      visibility: hidden;
      mso-hide: all;
      font-size: 1px;
      line-height: 1px;
      max-height: 0;
      max-width: 0;
      opacity: 0;
      overflow: hidden;
    }

    /* Type ------------------------------ */
    body,
    td,
    th {
      font-family: "Geist", Helvetica, Arial, sans-serif;
    }

    h1 {
      margin-top: 0;
      color: #09090B99;
      font-size: 14px;
      font-weight: bold;
      text-align: left;
    }

    h2 {
      margin-top: 0;
      color: #09090B;
      font-size: 22px;
      font-weight: bold;
      text-align: left;
      letter-spacing: 0.01rem;
    }

    h3 {
      margin-top: 0;
      color: #09090B;
      font-size: 14px;
      font-weight: bold;
      text-align: left;
    }

    td,
    th {
      font-size: 16px;
    }

    p,
    ul,
    ol,
    blockquote {
      color: #09090B99;
      margin: 0.4em 0 1.1875em;
      font-size: 14px;
      line-height: 1.625;
      letter-spacing: 0.01rem;
    }

    p.sub {
      font-size: 12px;
    }

    /* Utilities ------------------------------ */
    .align-right {
      text-align: right;
    }

    .align-left {
      text-align: left;
    }

    .align-center {
      text-align: center;
    }

    /* Buttons ------------------------------ */
    .button {
      background-color: #09090B;
      border-top: 9px solid #09090B;
      border-right: 10px solid #09090B;
      border-bottom: 9px solid #09090B;
      border-left: 10px solid #09090B;
      display: inline-block;
      color: #FFF;
      text-decoration: none;
      border-radius: 8px;
      -webkit-text-size-adjust: none;
      box-sizing: border-box;
    }

    @media only screen and (max-width: 500px) {
      .button {
        width: 100% !important;
        text-align: center !important;
      }
    }

    /* Attribute list ------------------------------ */
    .attributes {
      margin: 0 0 21px;
    }

    .attributes_content {
      border-radius: 8px;
      border: 1px solid #09090B1A;
    }

    .attributes_content_inner {
      padding: 11px;
    }

    .attributes_item {
      padding: 0;
    }


    body {
      background-color: #FFF;
      color: #09090B;
    }

    p {
      color: #09090B;
    }

    p.sub {
      color: #09090B;
    }

    .email-wrapper {
      width: 100%;
      margin: 0;
      padding: 0;
      -premailer-width: 100%;
      -premailer-cellpadding: 0;
      -premailer-cellspacing: 0;
      background-color: #FFF;
    }

    .email-content {
      width: 100%;
      margin: 0;
      padding: 0;
      -premailer-width: 100%;
      -premailer-cellpadding: 0;
      -premailer-cellspacing: 0;
    }

    /* Spacer ----------------------- */
    .email-spacer {
      padding: 24px 0;
      background-color: #FFF;
    }

    /* Body ------------------------------ */
    .email-body {
      width: 100%;
      margin: 0;
      padding: 0;
      -premailer-width: 100%;
      -premailer-cellpadding: 0;
      -premailer-cellspacing: 0;
      background-color: #FFF;
    }

    .email-body_inner {
      width: 400px;
      margin: 0 auto;
      padding: 0;
      -premailer-width: 400px;
      -premailer-cellpadding: 0;
      -premailer-cellspacing: 0;
      background-color: #FFF;
      border: 1px solid #09090B1A;
      border-radius: 24px;
    }

    .email-footer {
      width: 400px;
      margin: 0 auto;
      padding: 24px;
      -premailer-width: 400px;
      -premailer-cellpadding: 0;
      -premailer-cellspacing: 0;
      text-align: center;
    }

    .email-footer p {
      color: #09090B99;
    }

    .body-action {
      width: 100%;
      margin: 8px auto;
      padding: 0;
      -premailer-width: 100%;
      -premailer-cellpadding: 0;
      -premailer-cellspacing: 0;
      text-align: center;
    }

    .content-cell {
      padding: 32px 56px;
    }

    /*Media Queries ------------------------------ */
    @media only screen and (max-width: 400px) {

      .email-body_inner,
      .email-footer {
        width: 100% !important;
      }
    }
  </style>
  <!--[if mso]>
      <style type="text/css">
        .f-fallback  {
          font-family: Arial, sans-serif;
        }
      </style>
    <![endif]-->
  <style type="text/css" rel="stylesheet" media="all">
    body {
      width: 100% !important;
      height: 100%;
      margin: 0;
      -webkit-text-size-adjust: none;
    }

    body {
      font-family: "Geist", Helvetica, Arial, sans-serif;
    }

    body {
      background-color: #FFF;
      color: #09090B99;
    }
  </style>
</head>

<body
  style="width: 100% !important; height: 100%; -webkit-text-size-adjust: none; font-family: &quot;Geist&quot;, Helvetica, Arial, sans-serif; background-color: #FFF; color: #09090B99; margin: 0;"
  bgcolor="#FFF">
  <span class="preheader"
    style="display: none !important; visibility: hidden; mso-hide: all; font-size: 1px; line-height: 1px; max-height: 0; max-width: 0; opacity: 0; overflow: hidden;">Log-in
    attempt received on ${appName}.</span>

  <table class="email-wrapper" width="100%" cellpadding="0" cellspacing="0" role="presentation"
    style="width: 100%; -premailer-width: 100%; -premailer-cellpadding: 0; -premailer-cellspacing: 0; background-color: #FFF; margin: 0; padding: 0;"
    bgcolor="#FFF">
    <tr>
      <td align="center"
        style="word-break: break-word; font-family: &quot;Geist&quot;, Helvetica, Arial, sans-serif; font-size: 16px;">
        <table class="email-content" width="100%" cellpadding="0" cellspacing="0" role="presentation"
          style="width: 100%; -premailer-width: 100%; -premailer-cellpadding: 0; -premailer-cellspacing: 0; margin: 0; padding: 0;">
          <!-- Spacer -->
          <tr>
            <td class="email-spacer"
              style="word-break: break-word; font-family: &quot;Geist&quot;, Helvetica, Arial, sans-serif; font-size: 16px; text-align: center; padding: 24px 0;"
              align="center"></td>
          </tr>

          <!-- Email Body -->
          <tr>
            <td class="email-body" width="100%" cellpadding="0" cellspacing="0"
              style="word-break: break-word; margin: 0; padding: 0; font-family: &quot;Geist&quot;, Helvetica, Arial, sans-serif; font-size: 16px; width: 100%; -premailer-width: 100%; -premailer-cellpadding: 0; -premailer-cellspacing: 0; background-color: #FFFFFF;"
              bgcolor="#FFF">
              <table class="email-body_inner" align="center" width="570" cellpadding="0" cellspacing="0"
                role="presentation"
                style="width: 400px; -premailer-width: 400px; -premailer-cellpadding: 0; -premailer-cellspacing: 0; background-color: #FFF; margin: 0 auto; padding: 0;"
                bgcolor="#FFF">
                <!-- Body content -->
                <tr>
                  <td class="content-cell"
                    style="word-break: break-word; font-family: &quot;Geist&quot;, Helvetica, Arial, sans-serif; font-size: 16px; padding: 32px 32px;">
                    <div class="f-fallback">

                      <h1
                        style="margin-top: 0; color: #09090B99; font-size: 14px; font-weight: 650; letter-spacing: 0.01rem; text-align: left;"
                        align="left">${appName}</h1>

                      <h2
                        style="margin-top: 0; color: #09090B; font-size: 22px; font-weight: 750; text-align: left;"
                        align="left">Log in to your account</h2>

                      <p style="margin-top: 0; color: #09090B99; font-size: 14px; font-weight: 400; text-align: left;"
                        align="left">Hey there,
                        <br>
                        We've just received a login attempt for 
                        <span class="f-fallback" style="text-decoration: none;">
                          ${email},
                        </span>
                          with the following code:
                      </p>

                      <!-- Login confirm words -->
                      <table class="attributes" width="100%" cellpadding="0" cellspacing="0" role="presentation"
                        style="margin: 16px 0px;">
                        <tr>
                          <td class="attributes_content"
                            style="word-break: break-word; font-family: &quot;Geist&quot;, Helvetica, Arial, sans-serif; font-size: 16px; border-radius: 8px; border: 1px solid #09090B1A;"
                            bgcolor="#FFF">
                            <table class="attributes_content_inner" align="center" cellpadding="0" cellspacing="0"
                              role="presentation"
                              style="background-color: #FFF; margin: 0 auto; background-color: #FFF; padding: 9px;"
                              bgcolor="#FFF">
                              <tr>
                                <td align="center"
                                  style="word-break: break-word; font-family: &quot;Geist Mono&quot;, Helvetica, Arial, sans-serif; font-size: 16px;">
                                  <p class="f-fallback sub"
                                    style="font-size: 14px; font-weight:500; line-height: 1.0; margin: 0; color: #09090B; text-align: center;"
                                    align="center">
                                    <span class="f-fallback">
                                      ${code}
                                    </span>
                                  </p>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>

                      <p style="margin-top: 0; color: #09090B99; font-size: 14px; font-weight: 400; text-align: left;"
                        align="left">To log in, please click the button below & make sure you see the same code on the login page.</p>

                      <!-- Action -->
                      <table class="body-action" align="left" width="100%" cellpadding="0" cellspacing="0"
                        role="presentation"
                        style="width: 100%; -premailer-width: 100%; -premailer-cellpadding: 0; -premailer-cellspacing: 0; text-align: left; padding: 0;">
                        <tr>
                          <td align="left"
                            style="word-break: break-word; font-family: &quot;Geist&quot;, Helvetica, Arial, sans-serif; font-size: 16px;">
                            <!-- Border based button https://litmus.com/blog/a-guide-to-bulletproof-buttons-in-email-design -->
                            <table width="100%" border="0" cellspacing="0" cellpadding="0" role="presentation">
                              <tr>
                                <td align="left"
                                  style="word-break: break-word; font-family: &quot;Geist&quot;, Helvetica, Arial, sans-serif; font-weight: 450; font-size: 16px;">
                                  <a href="${callToAction}" class="f-fallback button" target="_blank"
                                    style="color: #FFF; border-color: #09090B; border-style: solid; border-width: 9px 10px; background-color: #09090B; display: inline-block; text-decoration: none; border-radius: 8px; -webkit-text-size-adjust: none; box-sizing: border-box;">
                                    Log in</a>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>

                      <!-- Separator line with padding -->
                      <table role="presentation" width="100%">
                        <tr>
                          <td style="padding: 16px 0;">
                            <hr style="border: 0.5px solid #09090B1A; width: 100%;">
                          </td>
                        </tr>
                      </table>

                      <!-- Disclaimer -->
                      <table role="presentation" style="width: 100%;">
                        <tr>
                          <td
                            style="word-break: break-word; font-family: &quot;Geist&quot;, Helvetica, Arial, sans-serif; font-size: 12px;">
                            <p class="f-fallback sub"
                              style="font-size: 12px; line-height: 1.625; color: #09090B99; letter-spacing:0.01rem; text-align:left; margin-block-start: 0px; margin-block-end: 0px;"
                              align="left">If you didn’t attempt to log in, you can ignore this email. Your account is safe.</p>
                          </td>
                        </tr>
                      </table>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Spacer -->
          <tr>
            <td class="email-spacer"
              style="word-break: break-word; font-family: &quot;Geist&quot;, Helvetica, Arial, sans-serif; font-size: 16px; text-align: center; padding: 24px 0;"
              align="center"></td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
