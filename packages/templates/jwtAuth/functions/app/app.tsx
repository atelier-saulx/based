import React, { useState } from 'react'
import { render } from 'react-dom'
import { Provider } from '@based/react'
import based from '@based/client'
import { useAuthState, useClient } from '@based/react'

// @ts-ignore - this is added on the server function
const client = based(window.basedConfig)
let rootEl = document.getElementById('root')

if (!rootEl) {
  rootEl = document.createElement('div')
  rootEl.id = 'root'
  document.body.appendChild(rootEl)
}

const Authorize = () => {
  const [register, setRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const client = useClient()
  const authState = useAuthState()

  if (!authState.token) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 300,
        }}
      >
        <div>
          <div>
            <div style={{ marginBottom: 16 }}>
              <a
                style={
                  register
                    ? {
                        textDecoration: 'underline',
                        cursor: 'pointer',
                      }
                    : {}
                }
                onClick={() => {
                  if (register) {
                    setRegister(false)
                  }
                }}
              >
                Login
              </a>{' '}
              |{' '}
              <a
                style={
                  register
                    ? {}
                    : {
                        textDecoration: 'underline',
                        cursor: 'pointer',
                      }
                }
                onClick={() => {
                  if (!register) {
                    setRegister(true)
                  }
                }}
              >
                Register
              </a>
            </div>
            <input
              placeholder="Email"
              value={email}
              onChange={(e) => {
                setEmail(e.currentTarget.value)
              }}
            />
            <input
              placeholder="Password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.currentTarget.value)
              }}
            />
            {register ? (
              <button
                onClick={async () => {
                  const response = await client.call('register', {
                    email,
                    password,
                  })
                }}
              >
                Register
              </button>
            ) : (
              <button
                onClick={async () => {
                  const response = await client.call('login', {
                    email,
                    password,
                  })
                }}
              >
                Login
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }
  return <App />
}

const App = () => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 300,
      }}
    >
      <div>
        <div>
          Logged in
          <br />
          <br />
          <button
            onClick={async () => {
              client.setAuthState({})
            }}
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  )
}

render(
  <Provider client={client}>
    <Authorize />
  </Provider>,
  rootEl
)
