# The Auth System

The *Based Auth* system helps developers add a security layer to their data. It does not enforce any logic itself, instead relies on a set of user-configurable *data functions* that restrict data access and implement whatever security strategy the user needs. Be it a 3rd party implementation or its own.

The central concept is that all messages through based go through a [`authorize`](https://github.com/atelier-saulx/based/blob/main/packages/client/docs/authorize.md) function that implements the security logic and decides if each specific call to data should continue or be blocked.
Within the data request, a "token" is also sent. This token is passed along to the `authorize` function for context, and it is what identifies the user in most implementations.

There are no assumptions about the "token" format. It is up to the user to choose what implementation it wants or needs. However, we provide templates for JSON Web Tokens (JWT) authorization and will soon offer session-based authentication templates. These templates provide minimal authorization strategy implementation and are meant to be tweaked and updated by the user.
Along with the `authorize` function, these templates also implement more optional functions that make a login flow more straightforward and more semantic. `login`, `logout`, and `renewToken`. 

The *Based* client also catches exceptions triggered by token expiration. When this happens, it tries to call a `renewToken` function sending it a renew payload that includes, for example, the "refreshToken" used for JWT authorization flow. If that's successful and it returns a new token, it will re-request the data with the new token for transparent renewal.

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

Sends email and password to the `login` data function for authentication.
Returns tokens if successful. Also will authomaticaly set the returned token for the current client.

#### Usage
```javascript
const tokens = await client.login({email, password}) 
```

### `client.logout()`

Clears the tokens hold by the client and calls the `logout` data function if it exists.


#### Usage
```javascript
await client.logout() 
```
