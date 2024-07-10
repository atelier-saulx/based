import { Component, createEffect, createSignal } from 'solid-js'
import { useBasedStatus } from '../useBasedStatus'
import TheLogo from '../../../../based.svg'

const BasedLiveStatus: Component = () => {
  const { status, connected } = useBasedStatus()
  const [connection, setConnection] = createSignal(false)

  createEffect(() => {
    setConnection(status() && connected())
  })

  return (
    <div
      style={{
        position: 'absolute',
        height: '35px',
        width: '120px',
        top: 'calc(100vh - 65px)',
        left: 'calc(100vw - 150px)',
        background: '#000000',
        color: '#FFFFFF',
        'font-size': '12px',
        'border-radius': '10px',
        padding: '10px',
        display: 'flex',
        'justify-items': 'center',
        'align-content': 'center',
        'align-items': 'center',
        cursor: connection() ? 'wait' : 'not-allowed',
      }}
    >
      <img src={TheLogo} alt="Based.io" />
      <p style={{ 'text-align': 'center', width: '100%' }}>
        {connection() ? 'Connected' : 'Disconnected'}
      </p>
    </div>
  )
}

export { BasedLiveStatus }
