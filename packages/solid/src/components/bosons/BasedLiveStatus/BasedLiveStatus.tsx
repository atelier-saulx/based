import { Component, createEffect, createSignal } from 'solid-js'
import { useBasedStatus } from '../useBasedStatus'
import { styled } from 'solid-styled-components'

/**
 * A component to include an overlay to show the connection status with the Based.io Cloud.
 * No props are necessary.
 *
 * @example
 * ```
 * <BasedLiveStatus />
 * ```
 */
const BasedLiveStatus: Component = () => {
  const { status, connected } = useBasedStatus()
  const [connection, setConnection] = createSignal(false)

  createEffect(() => {
    setConnection(status() && connected())
  })

  const MainContainer = styled('div')`
    position: fixed;
    height: 45px;
    width: 130px;
    top: calc(100vh - 75px);
    left: calc(100vw - 170px);
    background: #000000;
    border-radius: 10px;
    padding: 10px;
    display: flex;
    box-sizing: border-box;
    justify-items: center;
    align-content: center;
    align-items: center;
    cursor: ${connection() ? 'wait' : 'not-allowed'};
  `

  const StatusIndicator = styled('span')`
    text-align: center;
    width: 100%;
    font-size: 12px;
    color: #ffffff;
  `

  return (
    <MainContainer>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="25"
        height="25"
        viewBox="0 5 25 25"
        fill="none"
      >
        <path
          d="M21.6811 10.2031L10.8406 21.0437H0L10.8406 10.2031H21.6811Z"
          fill="#4B41FF"
        />
        <path
          d="M24.2321 21.0439L13.3915 31.8845H0L10.8406 21.0439H24.2321Z"
          fill="#FF1F85"
        />
        <path
          d="M10.8406 0L0 10.8406V21.0436L10.8406 10.203V0Z"
          fill="#008CFF"
        />
      </svg>
      <StatusIndicator>
        {connection() ? 'Connected' : 'Disconnected'}
      </StatusIndicator>
    </MainContainer>
  )
}

export { BasedLiveStatus }
