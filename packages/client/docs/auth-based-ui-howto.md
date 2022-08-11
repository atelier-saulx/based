## JWT Auth Flow HowTo using based/ui

This guide shows how to implement authentication using [based/ui](https://github.com/atelier-saulx/ui) UI library and its authentication components.
The tutorial example files can be found in [this repository](https://github.com/atelier-saulx/auth-demo).

### Imports

Components can be imported or required from the [`@based/ui`](https://www.npmjs.com/package/@based/ui) npm package.
```bash
$ npm install @based/ui
```

```javascript
import { Provider, Authorize } from '@based/ui'
```

### Provider

The first step is to wrap the app with a `<Provider />` component. This will set up the app to handle third-party auth provider callbacks and handle overlays and themes from the `based/ui` library.
The `<Provider />` component expects the main app component as a child and a [based client](https://github.com/atelier-saulx/based/blob/main/packages/client/README.md) as the `client` argument.

```javascript
const client = based(basedConfig)
render(
  <Provider client={client}>
    <App />
  </Provider>,
  rootEl
)
```

### Authorize component

The Authorize component renders other components only when a user is authenticated. If the user is not authenticated, it will show a login/register dialog.
Email, Google, Microsoft, and Github provider handler functions are installed in new environments by default. We encourage you to check these [templates](https://github.com/atelier-saulx/based/tree/main/packages/templates/jwtAuth/functions) and adapt them to your needs by adding the [data functions](https://github.com/atelier-saulx/based/tree/main/packages/templates/jwtAuth/functions) to your project and [deploying](https://github.com/atelier-saulx/based/blob/main/packages/cli/README.md#deploy) them with the [based CLI](https://github.com/atelier-saulx/based/blob/main/packages/cli/README.md).

```javascript
  <Authorize
    // googleClientId="<your_google_client_id>"
    // microsoftClientId="<your_microsoft_client_id>"
    // githubClientId="<your_github_client_id>"
    app={LoggedinBody}
  />
```

The protected sections of your site should be wrapped in a component passed to the `app` argument. 
The component is passed as an argument instead of `children`, so the protected components are never rendered if the user is not authenticated.

### Email provider

New environments came by default, with a `user` type ready to receive email registrations. The [`register` user data function](https://github.com/atelier-saulx/based/blob/main/packages/templates/jwtAuth/functions/registerUser/index.ts) registers new users using the name and email address, sends a confirmation email, and waits for the new user to click the email message he received confirming the email address.

### Google provider

To enable the Sign In with Google provider and button, you need to configure the google client id and google client secret.
Follow the instructions in [this](https://developers.google.com/identity/sign-in/web/sign-in) page to the point where you have both.
The client id is configured in the `<Authorize />` component as the `googleClientId` argument.
The client secret should be saved as a [secret](https://github.com/atelier-saulx/based/tree/main/packages/cli#secrets) with the name `google-client-secret-<project>-<env>` where `<project>` and `<env>` should be replaced with the name of your project and environment.
The Google credential should be configured with your domain and `https://<your_domain>/auth-google` as the callback address.

### Microsoft provider

To enable the Microsoft Identity Platform provider, you need to configure a Microsoft client id.
Follow the instructions in [this](https://docs.microsoft.com/en-us/azure/active-directory/develop/web-api-quickstart?pivots=devlang-aspnet) page until you have the Microsoft client id.
The client id is configured in the `<Authorize />` component with the `microsoftClientId` argument.
The Azure application should be configured with your domain and `https://<your_domain>/auth-microsoft` as the callback address.

### GitHub provider

To enable the GitHub Oauth provider, your need to configure your GitHub client id and client secret.
Follow the instructions in [this](https://docs.github.com/en/developers/apps/building-github-apps/creating-a-github-app) page to get both.
Be sure to de your domain name and user `https://<your_domain>/auth-github` as the callback address.
The client id should be configured in the `<Authorize />` component using the `githubClientId` argument. The client secret should be saved as a [secret](https://github.com/atelier-saulx/based/tree/main/packages/cli#secrets) with the name `github-client-secret-<project>-<env>` where `<project>` and `<env>` should be replaced with the name of your project and environment.

