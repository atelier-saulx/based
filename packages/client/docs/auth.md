# The Auth System

The *Based Auth* system helps developers add a security layer to their data. It does not enforce any logic itself, instead relies on a set of user-configurable *data functions* that restrict data access and implement whatever security strategy the user needs. Be it a 3rd party implementation or its own.

The central concept is that all messages through based go through a [`authorize`](https://github.com/atelier-saulx/based/blob/main/packages/client/docs/authorize.md) function that implements the security logic and decides if each specific call to data should continue or be blocked.
Within the data request, a "token" is also sent. This token is passed along to the `authorize` function for context, and it is what identifies the user in most implementations.

There are no assumptions about the "token" format. It is up to the user to choose what implementation it wants or needs. However, we provide templates for JSON Web Tokens (JWT) authorization and will soon offer session-based authentication templates. These templates provide minimal authorization strategy implementation and are meant to be tweaked and updated by the user.
Along with the `authorize` function, these templates also implement more optional functions that make a login flow more straightforward and more semantic. `login`, `logout`, and `renewToken`. 

The *Based* client also catches exceptions triggered by token expiration. When this happens, it tries to call a `renewToken` function sending it a renew payload that includes, for example, the "refreshToken" used for JWT authorization flow. If that's successful and it returns a new token, it will re-request the data with the new token for transparent renewal.

## Auth data functions

### `authorize`

This data function runs every time the based client tries to call, get, modify or observe data.
It approves or denies the request depending on its context. See [`authorize`](https://github.com/atelier-saulx/based/blob/main/packages/client/docs/authorize.md)
Returns boolean value allowing or disallowing the connection.

Example: see [here](https://github.com/atelier-saulx/based/blob/main/packages/templates/jwtAuth/functions/authorize/index.ts)

### `login`

Called then the client [login()]() method is called. It should authenticate the user and generate the tokens. Authentication flow is up to the user.
For example, in a JWT flow, this function will validate the user in the data, sign a token and refreshToken returning them to the client.

Example: see [here](https://github.com/atelier-saulx/based/blob/main/packages/templates/jwtAuth/functions/login/index.ts)

### `logout`

When your app logs out a user, it should call the `client.logout()` method. This method calls this data function if it exists. It is meant to have token invalidation and any cleanup that should happen when a user logs out.

Example: see [here](https://github.com/atelier-saulx/based/blob/main/packages/templates/jwtAuth/functions/logout/index.ts)

### `renewToken`

For auth flows that rely on token renewal. This data function runs when a specific error is triggered in the `authorize` function.
The result is returned to the client using the `renewToken` client event.

Example: see [here](https://github.com/atelier-saulx/based/blob/main/packages/templates/jwtAuth/functions/renewToken/index.ts)

## Based client methods

### `client.auth()`

Sets the token to be sent during client/server messages. The token will be passed to the `authorize` function and can be decoded from it with `based.token()`.

#### Usage
```javascript
// Setting token
await client.auth(token)

// Setting token and refreshToken for JWT flow
await client.auth(token, { 
	renewOptions: { refreshToken }
})
```

### `client.login()`

This data function sends the email and password to the `login` data function for authentication.
Returns tokens if successful. Also, it will automatically set the returned token on the current client connection.

#### Usage
```javascript
const tokens = await client.login({email, password}) 
```

### `client.logout()`

Clears the tokens stored by the client and calls the `logout` data function if it exists.

#### Usage
```javascript
await client.logout() 
```

### `client.on('renewToken', fn)`

This event is called when the renewToken data function is run. It is used to handle and persist the newly generated tokens.

#### Usage
```javascript
	client.on('renewToken', (renewTokenResult) => {})
```


## How to use

Check the guides bellow for examples of how the use:
- [React](https://github.com/atelier-saulx/based/blob/main/packages/client/docs/auth-howto.md)
- [React with based/ui library](https://github.com/atelier-saulx/based/blob/main/packages/client/docs/auth-based-ui-howto.md)
