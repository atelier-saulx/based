# `Authorize` data function

The authorize data function is a special function that serves as an authorization gatekeeper for the based queries and calls to data functions. It is called every time one of them is made and blocks or allows access to the data.
It works and has the same signature as normal data functions and should return a Promise with `true` or `false` boolean. 
You can have your access logic here. Checking if the user is authenticated, or if it matches whatever criteria you need for your application.

example:
```javascript
export default async ({ based, user, payload, name, type, callstack}) => {
	// ...
	return true // or false
}
```

### Exposed parameters

| Parameter   | Description                                                                                                                                                                    |
|-------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `based`     | Based client                                                                                                                                                                   |
| `user`      | User object. Exposes token information about the user                                                                                                                          |
| `payload`   | The query requested or the payload sent to the function                                                                                                                        |
| `name`      | Name of the function. Empty in case of a query                                                                                                                                 |
| `type`      | Type of call. `function` or `query` usually                                                                                                                                    |
| `callstack` | Array with the names of the data function call stack. If one function calls another, the first function name will show in the callstack of the second function and so on. |


## `user.token()`

The `user` parameter exposes functionality to identify the user. If a user is authenticated, the based client will send a authorization token in the message. You can validate the token and decode it using the `user.token()`

Example:
```javascript
export default async ({ based, user, payload, name, type, callstack}) => {
	const token = user.token('publicKeySecret')
	if (token.id) {
		return true
	}

	return false
}
```
