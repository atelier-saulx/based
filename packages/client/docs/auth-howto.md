## JWT Auth Flow HowTo

A short guide to setting up the JWT authentication flow using based.
An example with the info on this guide can be foud [here](https://github.com/atelier-saulx/auth-demo)

If you created an environment using the based website, the JWT auth flow template is installed by default. This template includes the `user` type schema, the public and private keys, and the default `authorize`, `login`, `logout`, and `renewToken` data functions.

These default data functions can be customized to your needs. Add them to your project from [here]() and deploy with the based cli `deploy` command.

### Adding a user to the database

You now need to add a user to the database so that he can log in.
There are several ways to do this, including the data editor in the Based website admin area.
We'll add it through a script from the developer's computer environment as it also shows how you can add this functionality from your own apps.

The `user` type installed by default as the following schema:

```
	...
	types: {
		user: {
			prefix: 'us',
			fields: {
				name: { type: 'string' },
				email: { type: 'email' },
				password: { type: 'digest' },
			},
		},
	},
```

It is ready to accept users with an email, name string, and hashed password.
Let's create a user from a script.

#### Setting up an apiKey 

If we try to add a user now from a script, we get into a chicken and the egg issue. We don't have an authenticated user to add the user itself. You can work around this while developing using the apiKey functionality.
This feature lets us create an apikey so we can use based in utility scripts and commands using the _based cli_.

```bash
$ npx based apiKeys add --name auth-demo-api-key --file ./apiKey.key
```

This command will create an apiKey called "auth-demo-api-key" and saves its value to a file we can load from the script or use as an argument in the _based cli_.

**Note:** You should never store apiKeys as plain text in repositories or use them to make based connections client side.

#### Setting a user with a script

With the apiKey, we can now run a simple script to add a new user:

```javascript
// scripts/createUser.ts

import fs from 'fs'
import based from '@based/client'

// Loads the based config file that sets up your based connection
const basedConfig = JSON.parse(fs.readFileSync('../based.json', 'utf8'))

// Loads apiKey so we can have based access from a script
// Note: apiKeys should only be used for util scripts or server/server connections
const apiKey = fs.readFileSync('../apiKey.key', 'utf8')

;(async () => {
  // Create a based client
  const client = based(basedConfig)

  // Autheicate client with an apiKey
  await client.auth(apiKey, { isApiKey: true })

  // Add our user
  const { id } = await client.set({
    type: 'user',
    name: 'Demo User',
    email: 'demo@wawa.com',
    password: 'superStrongPassword',
  })
  console.log('Added user ' + id)

  process.exit()
})()
```

And lets run it:
```bash
$ cd scripts
$ npx ts-node scripts/createUser.ts
Added user us1b3d5a36
```

## Adding login functionality to your app.

To login a user from your app, you should create a login UI, and use the based client `.login()` method to validate your user and password.
Example:

```javascript
import based from '@based/client'

// ...


	<button
		onClick={async () => {
			const { token, refreshToken } = await client.login({
				email,
				password,
			})
			setToken(token)
			setRefreshToken(refreshToken)
		}}
	>
		Login
	</button>
```

The `.login()` method takes the email and password supplied by the user, passes it to the `login` data function, and returns the result. Usually, a token and refreshToken if it was successful.
You should also store your token and refreshToken if you want the session to persist.

## Authenticating the user with a persisted token

If your user already logged in and you persisted the tokens, you can authenticate it with the still valid token instead of login in.
Example:
```javascript
	// ...
	if (token) {
		await client.auth(token, { refreshToken })
	}
```

The `refreshToken` is also stored by the based client so it can be requested by the based servers if the token is expired and it tries to renew the token automatically.

## Login out user

You should run the based client `.logout()` method to explicitly log out a user. This method will clear the tokens on the based client and run the `logout` data function meant to perform clean-up actions like invalidating the current refreshToken.

Example:
```javascript
	// ...
	<button
		onClick={async () => {
			await client.logout()
			setToken(null)
			setRefreshToken(null)
		}}
	>
		Logout
	</button>
```

You should also clean the stored token and refreshToken from the browser.

## Handling automatic token renewal

The default template already has in place JWT token renewal using a refreshToken. You should however store the new token locally when this happens.
For this we have the `renewToken` based client event that we can listen.
Example:

```javascript
	// ...
  const renewHandler = ({ token: newToken }: { token: string }) => {
    setToken(newToken)
  }

	client.on('renewToken', renewHandler)
```
