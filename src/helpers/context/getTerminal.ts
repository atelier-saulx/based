import blessed from '@farjs/blessed'
import { parseMessage } from '../../shared/parseMessage.js'

export const contextGetTerminal = ({
  title,
  header: headerContent,
  lines: linesConfig,
}: Based.Context.Terminal) => {
  let autoScroll: boolean = true

  const screen = blessed.screen({
    smartCSR: true,
    fullUnicode: true,
    title,
  })

  const headerElement = blessed.box({
    top: 0,
    left: 0,
    width: '100%',
    align: 'left',
    valign: 'top',
    style: {
      fg: 'white',
    },
  })

  const mainContainer = blessed.box({
    bottom: 0,
    left: 'center',
    width: '100%',
    scrollable: true,
    alwaysScroll: true,
    scrollbar: {
      ch: ' ',
      track: { bg: 'white' },
    },
  })

  const kill = (fn: any) => screen.key(['C-c'], fn)
  const render = () => screen.render()

  const header = (content: string) => {
    headerElement.setContent(
      parseMessage(content) + '\n' + '─'.repeat(process.stdout.columns),
    )

    headerElement.height = content?.split('\n').length + 1
    mainContainer.height = `100%-${headerElement.height}`
    render()
  }

  const lines: string[] = []

  const addLine = (msg: string | string[]) => {
    if (!msg.length) {
      render()
      return
    }

    if (Array.isArray(msg)) {
      if (linesConfig && linesConfig?.sort === 'asc') {
        lines.unshift(...msg)
      } else {
        lines.push(...msg)
      }
    } else {
      if (linesConfig && linesConfig?.sort === 'asc') {
        lines.unshift(msg)
      } else {
        lines.push(msg)
      }
    }

    mainContainer.setContent(lines.join('\n'))

    if (autoScroll && linesConfig && linesConfig?.sort === 'desc') {
      mainContainer.setScrollPerc(100)
    }

    render()
  }

  // const setTable = (data) => {
  // mainContainer.setData(lines.join('\n'))
  // }

  screen.key(['escape', 'q', 'C-c'], function () {
    return process.exit(0)
  })

  screen.key(['up', 'down'], (_, key) => {
    const scrollPosition: number = mainContainer.getScrollPerc()

    if (key.name === 'up') {
      mainContainer.scroll(-1)

      if (scrollPosition > 0) {
        autoScroll = false
      }
    } else if (key.name === 'down') {
      mainContainer.scroll(1)

      if (scrollPosition === 100) {
        autoScroll = true
      }
    }

    render()
  })

  screen.append(headerElement)
  screen.append(mainContainer)

  header(headerContent)

  render()

  return {
    render,
    header,
    kill,
    addLine,
    autoScroll,
  }
}
