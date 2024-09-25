import blessed from '@farjs/blessed'
import { parseMessage } from './parseMessage.js'

export const getTerminal = (title: string, header: string) => {
  let autoScroll: boolean = true

  const screen = blessed.screen({
    smartCSR: true,
    fullUnicode: true,
    title,
  })

  const headerHeight: number = 4

  const headerElement = blessed.box({
    top: 0,
    left: 0,
    width: '100%',
    height: headerHeight,
    content: parseMessage(header),
    align: 'left',
    valign: 'top',
    style: {
      fg: 'white',
    },
  })

  const messageBox = blessed.box({
    bottom: 0,
    left: 'center',
    width: '100%',
    height: `100%-${headerHeight}`,
    scrollable: true,
    alwaysScroll: true,
    scrollbar: {
      ch: ' ',
      track: { bg: 'white' },
    },
  })

  const messages: string[] = []

  const kill = (fn: any) => screen.key(['C-c'], fn)
  const render = () => screen.render()
  const addMessage = (msg: string | string[]) => {
    if (!msg.length) {
      render()
      return
    }

    if (Array.isArray(msg)) {
      messages.unshift(...msg)
    } else {
      messages.unshift(msg)
    }

    messageBox.setContent(messages.slice().reverse().join('\n'))

    if (autoScroll) {
      messageBox.setScrollPerc(100)
    }

    render()
  }

  screen.key(['up', 'down'], (_, key) => {
    const scrollPosition: number = messageBox.getScrollPerc()

    if (key.name === 'up') {
      messageBox.scroll(-1)

      if (scrollPosition > 0) {
        autoScroll = false
      }
    } else if (key.name === 'down') {
      messageBox.scroll(1)

      if (scrollPosition === 100) {
        autoScroll = true
      }
    }

    render()
  })

  screen.append(headerElement)
  screen.append(messageBox)

  render()

  return {
    render,
    kill,
    addMessage,
  }
}
