import { Component } from 'solid-js'
import { render } from 'solid-js/web'

const App: Component = () => {
  return (
    <div
      style={{
        padding: '100px',
      }}
    >
      Hello SolidJS
    </div>
  )
}
//
// const root = createRoot(document.getElementById('root'))
// root.render(<App />)

const root = document.getElementById('root')
render(() => <App />, root!)
