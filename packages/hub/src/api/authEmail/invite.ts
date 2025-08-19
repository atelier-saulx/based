export const inviteTemplate = ({
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
    <meta name="color-scheme" content="light dark" />
    <meta name="supported-color-schemes" content="light dark" />
    <title></title>
    <style type="text/css" rel="stylesheet" media="all">
      /* Base ------------------------------ */
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

      body {
        width: 100% !important;
        height: 100%;
        margin: 0;
        -webkit-text-size-adjust: none;
      }

      a {
        color: #3869d4;
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
        font-family: 'Inter', Helvetica, Arial, sans-serif;
      }

      h1 {
        margin-top: 0;
        color: #29292c;
        font-size: 15px;
        font-weight: bold;
        text-align: left;
      }

      h2 {
        margin-top: 0;
        color: #29292c;
        font-size: 16px;
        font-weight: bold;
        text-align: left;
      }

      h3 {
        margin-top: 0;
        color: #29292c;
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
        margin: 0.4em 0 1.1875em;
        font-size: 16px;
        line-height: 1.625;
      }

      p.sub {
        font-size: 13px;
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
        background-color: #3869d4;
        border-top: 10px solid #3869d4;
        border-right: 18px solid #3869d4;
        border-bottom: 10px solid #3869d4;
        border-left: 18px solid #3869d4;
        display: inline-block;
        color: #fff;
        text-decoration: none;
        border-radius: 4px;
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
        border-radius: 4px;
        border: 1px solid rgba(15, 16, 19, 0.12);
      }

      .attributes_content_inner {
        padding: 11px;
      }

      .attributes_item {
        padding: 0;
      }

      body {
        background-color: #f4f4f7;
        color: #29292c;
      }

      p {
        color: #29292c;
      }

      p.sub {
        color: #29292c;
      }

      .email-wrapper {
        width: 100%;
        margin: 0;
        padding: 0;
        -premailer-width: 100%;
        -premailer-cellpadding: 0;
        -premailer-cellspacing: 0;
        background-color: #f4f4f7;
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
        padding: 25px 0;
        background-color: #ffffff;
      }

      /* Body ------------------------------ */
      .email-body {
        width: 100%;
        margin: 0;
        padding: 0;
        -premailer-width: 100%;
        -premailer-cellpadding: 0;
        -premailer-cellspacing: 0;
        background-color: #ffffff;
      }

      .email-body_inner {
        width: 580px;
        margin: 0 auto;
        padding: 0;
        -premailer-width: 580px;
        -premailer-cellpadding: 0;
        -premailer-cellspacing: 0;
        background-color: #ffffff;
        border: 1px solid rgba(15, 16, 19, 0.08);
        border-radius: 16px;
      }

      .email-footer {
        width: 580px;
        margin: 0 auto;
        padding: 20px;
        -premailer-width: 580px;
        -premailer-cellpadding: 0;
        -premailer-cellspacing: 0;
        text-align: center;
      }

      .email-footer p {
        color: #6b6e76;
      }

      .body-action {
        width: 100%;
        margin: 30px auto;
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
      @media only screen and (max-width: 600px) {
        .email-body_inner,
        .email-footer {
          width: 100% !important;
        }
      }

      @media (prefers-color-scheme: dark) {
        body,
        .email-body,
        .email-body_inner,
        .email-content,
        .email-wrapper,
        .email-spacer,
        .email-footer {
          background-color: #131313 !important;
          color: #fff !important;
        }

        .email-body_inner {
          border: 1px solid rgba(255, 255, 255, 0.08) !important;
        }

        p,
        ul,
        ol,
        blockquote,
        h1,
        h2,
        h3,
        span {
          color: #fff !important;
        }

        .attributes_content_inner strong {
          color: #000 !important;
        }

        .lightImage {
          display: none !important;
        }

        .darkImageWrapper,
        .darkImage {
          display: block !important;
        }
      }

      :root {
        color-scheme: light dark;
        supported-color-schemes: light dark;
      }
    </style>
    <!--[if mso]>
      <style type="text/css">
        .f-fallback {
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
        font-family: 'Inter', Helvetica, Arial, sans-serif;
      }

      body {
        background-color: #f4f4f7;
        color: #51545e;
      }
    </style>
  </head>

  <body
    style="
      width: 100% !important;
      height: 100%;
      -webkit-text-size-adjust: none;
      font-family: 'Inter', Helvetica, Arial, sans-serif;
      background-color: #f4f4f7;
      color: #51545e;
      margin: 0;
    "
    bgcolor="#F4F4F7"
  >
    <span
      class="preheader"
      style="
        display: none !important;
        visibility: hidden;
        mso-hide: all;
        font-size: 1px;
        line-height: 1px;
        max-height: 0;
        max-width: 0;
        opacity: 0;
        overflow: hidden;
      "
    >Login to your account.</span
    >

    <table
      class="email-wrapper"
      width="100%"
      cellpadding="0"
      cellspacing="0"
      role="presentation"
      style="
        width: 100%;
        -premailer-width: 100%;
        -premailer-cellpadding: 0;
        -premailer-cellspacing: 0;
        background-color: #f4f4f7;
        margin: 0;
        padding: 0;
      "
      bgcolor="#F4F4F7"
    >
      <tr>
        <td
          align="center"
          style="
            word-break: break-word;
            font-family: 'Inter', Helvetica, Arial, sans-serif;
            font-size: 16px;
          "
        >
          <table
            class="email-content"
            width="100%"
            cellpadding="0"
            cellspacing="0"
            role="presentation"
            style="
              width: 100%;
              -premailer-width: 100%;
              -premailer-cellpadding: 0;
              -premailer-cellspacing: 0;
              margin: 0;
              padding: 0;
            "
          >
            <!-- Spacer -->
            <tr>
              <td
                class="email-spacer"
                style="
                  word-break: break-word;
                  font-family: 'Inter', Helvetica, Arial, sans-serif;
                  font-size: 16px;
                  text-align: center;
                  padding: 25px 0;
                "
                align="center"
              ></td>
            </tr>

            <!-- Email Body -->
            <tr>
              <td
                class="email-body"
                width="100%"
                cellpadding="0"
                cellspacing="0"
                style="
                  word-break: break-word;
                  margin: 0;
                  padding: 0;
                  font-family: 'Inter', Helvetica, Arial, sans-serif;
                  font-size: 16px;
                  width: 100%;
                  -premailer-width: 100%;
                  -premailer-cellpadding: 0;
                  -premailer-cellspacing: 0;
                  background-color: #ffffff;
                "
                bgcolor="#FFFFFF"
              >
                <table
                  class="email-body_inner"
                  align="center"
                  width="570"
                  cellpadding="0"
                  cellspacing="0"
                  role="presentation"
                  style="
                    width: 580px;
                    -premailer-width: 580px;
                    -premailer-cellpadding: 0;
                    -premailer-cellspacing: 0;
                    background-color: #ffffff;
                    margin: 0 auto;
                    padding: 0;
                  "
                  bgcolor="#FFFFFF"
                >
                  <!-- Body content -->
                  <tr>
                    <td
                      class="content-cell"
                      style="
                        word-break: break-word;
                        font-family: 'Inter', Helvetica, Arial, sans-serif;
                        font-size: 16px;
                        padding: 32px 56px;
                      "
                    >
                      <div class="f-fallback">
                        <!-- Logo -->
                        <div align="center">
                          <img
                            src="https://based-images.imgix.net/logo.jpg?auto=format&q=100"
                            alt="Based"
                            width="108"
                            height="32"
                            class="lightImage"
                          />

                          <!--[if !mso]><! -->
                          <div
                            class="darkImageWrapper"
                            style="mso-hide: all; display: none"
                          >
                            <img
                              src="https://based-images.imgix.net/logo-black.jpg?auto=format&q=100"
                              alt="Based"
                              width="108"
                              height="32"
                              class="darkImage"
                              style="display: none"
                            />
                          </div>
                          <!--<![endif]-->
                        </div>

                        <h1
                          style="
                            margin-top: 0;
                            color: #29292c;
                            font-size: 18px;
                            font-weight: 700;
                            text-align: center;
                            margin: 1.2em 0 1.2em;
                          "
                          align="center"
                        >
                        User access to ${appName}.
                        </h1>

                        <p
                          style="
                            margin-top: 0;
                            color: #29292c;
                            font-size: 15px;
                            font-weight: 400;
                            text-align: center;
                          "
                          align="center"
                        >
                          Hello
                          <span class="f-fallback">
                            <strong>${email},</strong>
                          </span>
                        </p>
                        <p
                          style="
                            margin-top: 0;
                            margin-bottom: 0;
                            color: #333333;
                            font-size: 15px;
                            font-weight: 400;
                            text-align: center;
                          "
                          align="center"
                        >
                        You've been granted access to the ${appName} application.

                        </p>

                        <!-- Login confirm words -->
                        <table
                          class="attributes"
                          width="100%"
                          cellpadding="0"
                          cellspacing="0"
                          role="presentation"
                          style="margin: 32px 0px"
                        >
                          <tr>
                            <td
                              class="attributes_content"
                              style="
                                word-break: break-word;
                                font-family:
                                  'Inter', Helvetica, Arial, sans-serif;
                                font-size: 16px;
                              "
                              bgcolor="#F4F4F7"
                            >
                              <table
                                class="attributes_content_inner"
                                align="center"
                                cellpadding="0"
                                cellspacing="0"
                                role="presentation"
                                style="
                                  background-color: #f4f4f7;
                                  margin: 0 auto;
                                  background-color: #f4f4f7;
                                  padding: 11px;
                                "
                                bgcolor="#F4F4F7"
                              >
                                <tr>
                                  <td
                                    align="center"
                                    style="
                                      word-break: break-word;
                                      font-family:
                                        'Inter', Helvetica, Arial, sans-serif;
                                      font-size: 16px;
                                    "
                                  >
                                    <p
                                      class="f-fallback sub"
                                      style="
                                        font-size: 15px;
                                        line-height: 1;
                                        margin: 0;
                                        color: #29292c;
                                        text-align: center;
                                      "
                                      align="center"
                                    >
                                      <span class="f-fallback">
                                        <strong>${code}</strong>
                                      </span>
                                    </p>
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>

                        <p
                          style="
                            margin-top: 0;
                            color: #29292c;
                            font-size: 15px;
                            font-weight: regular;
                            text-align: center;
                          "
                          align="center"
                        >
                          Please click the link below to accept the invite.
                        </p>

                        <!-- Action -->
                        <table
                          class="body-action"
                          align="center"
                          width="100%"
                          cellpadding="0"
                          cellspacing="0"
                          role="presentation"
                          style="
                            width: 100%;
                            -premailer-width: 100%;
                            -premailer-cellpadding: 0;
                            -premailer-cellspacing: 0;
                            text-align: center;
                            margin: 30px auto;
                            padding: 0;
                          "
                        >
                          <tr>
                            <td
                              align="center"
                              style="
                                word-break: break-word;
                                font-family:
                                  'Inter', Helvetica, Arial, sans-serif;
                                font-size: 16px;
                              "
                            >
                              <!-- Border based button https://litmus.com/blog/a-guide-to-bulletproof-buttons-in-email-design -->
                              <table
                                width="100%"
                                border="0"
                                cellspacing="0"
                                cellpadding="0"
                                role="presentation"
                              >
                                <tr>
                                  <td
                                    align="center"
                                    style="
                                      word-break: break-word;
                                      font-family:
                                        'Inter', Helvetica, Arial, sans-serif;
                                      font-size: 16px;
                                    "
                                  >
                                    <a
                                      href="${callToAction}"
                                      class="f-fallback button"
                                      target="_blank"
                                      style="
                                        color: #fff;
                                        border-color: #3d53e7;
                                        border-style: solid;
                                        border-width: 12px 50px;
                                        background-color: #3d53e7;
                                        display: inline-block;
                                        text-decoration: none;
                                        border-radius: 4px;
                                        -webkit-text-size-adjust: none;
                                        box-sizing: border-box;
                                      "
                                      >Verify and log in</a
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>

                        <!-- Disclaimer -->
                        <table role="presentation" style="width: 100%">
                          <tr>
                            <td
                              style="
                                word-break: break-word;
                                font-family:
                                  'Inter', Helvetica, Arial, sans-serif;
                                font-size: 16px;
                              "
                            >
                              <p
                                class="f-fallback sub"
                                style="
                                  font-size: 13px;
                                  line-height: 1.625;
                                  color: #6b6e76;
                                  margin: 0.4em 0 1.1875em;
                                  text-align: center;
                                "
                                align="center"
                              >
                                Please ignore this email if you didn’t try to login on this application.
                              </p>
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
              <td
                class="email-spacer"
                style="
                  word-break: break-word;
                  font-family: 'Inter', Helvetica, Arial, sans-serif;
                  font-size: 16px;
                  text-align: center;
                  padding: 25px 0;
                "
                align="center"
              ></td>
            </tr>

            <!-- Footer -->
            <tr>
              <td
                style="
                  word-break: break-word;
                  font-family: 'Inter', Helvetica, Arial, sans-serif;
                  font-size: 16px;
                "
              >
                <table
                  class="email-footer"
                  align="center"
                  width="580"
                  cellpadding="0"
                  cellspacing="0"
                  role="presentation"
                  style="
                    width: 580px;
                    -premailer-width: 580px;
                    -premailer-cellpadding: 0;
                    -premailer-cellspacing: 0;
                    text-align: center;
                    margin: 0 auto;
                    padding: 0;
                  "
                >
                  <tr>
                    <td
                      class="content-cell"
                      align="center"
                      style="
                        word-break: break-word;
                        font-family: 'Inter', Helvetica, Arial, sans-serif;
                        font-size: 16px;
                        padding: 56px;
                      "
                    >
                      <p
                        class="f-fallback sub align-center"
                        style="
                          font-size: 13px;
                          line-height: 1.625;
                          text-align: center;
                          color: #6b6e76;
                          margin: 0.4em 0 1.1875em;
                        "
                        align="center"
                      >
                        © 2022 Saulx. All rights reserved.
                      </p>
                      <p
                        class="f-fallback sub align-center"
                        style="
                          font-size: 13px;
                          line-height: 1.625;
                          text-align: center;
                          color: #6b6e76;
                          margin: 0.4em 0 1.1875em;
                        "
                        align="center"
                      >
                        <span class="f-fallback">
                          <strong>Saulx B.V.</strong>
                        </span>

                        <br />Herengracht 472 <br />1017 CA <br />Amsterdam
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
