import { padLeft } from '@saulx/utils'

const debounce = (callback: Function, wait: number = 1) => {
  let timeoutId: ReturnType<typeof setTimeout>
  return (...args) => {
    window.clearTimeout(timeoutId)
    timeoutId = setTimeout(() => {
      // eslint-disable-next-line
      callback.apply(null, args)
    }, wait)
  }
}

document.body.style.padding = '10px'
document.body.style.display = 'flex'
document.body.style.height = '100vh'
document.body.style.width = '100vh'
document.body.style.overflow = 'hidden'
document.body.style.flexDirection = 'column'

const buttonHolder = document.createElement('div')
buttonHolder.style.width = '100%'
document.body.appendChild(buttonHolder)

export const button = (label: string, fn: () => void) => {
  const button = document.createElement('button')
  button.innerHTML = label
  button.style.padding = '16px'
  button.style.border = '2px solid #000'
  button.style.borderRadius = '4px'
  button.style.fontSize = '14px'
  button.style.fontWeight = 'bold'
  button.style.cursor = 'pointer'
  button.style.margin = '10px'
  button.style.fontFamily = 'Andale Mono'
  button.onclick = fn
  buttonHolder.appendChild(button)
}

export const uploadButton = (
  label: string,
  fn: (files: File[], p: (progress: number) => void) => void
) => {
  const button = document.createElement('label')

  button.innerHTML = `<span style="cursor:pointer">${label}</span>
<input multiple type="file" style="display: none">`

  button.style.padding = '16px'
  button.style.border = '2px solid #000'
  button.style.borderRadius = '4px'
  button.style.fontSize = '14px'
  button.style.fontWeight = 'bold'
  button.style.cursor = 'pointer'
  button.style.position = 'relative'
  button.style.margin = '10px'
  button.style.fontFamily = 'Andale Mono'

  const info = button.children[0]

  const update = debounce((p) => {
    info.innerHTML = Math.round(p * 100) + '%'
    if (p === 1) {
      info.innerHTML = label
    }
  })

  button.children[1].addEventListener('input', () => {
    // @ts-ignore
    fn(button.children[1].files, update)
  })

  buttonHolder.appendChild(button)
}

export const toggleButton = (
  label: string,
  fn: () => () => void,
  isToggle = false
) => {
  const button = document.createElement('button')
  button.innerHTML = label
  button.style.padding = '16px'
  button.style.border = '2px solid #000'
  button.style.borderRadius = '4px'
  button.style.fontSize = '14px'
  button.style.fontWeight = 'bold'
  button.style.cursor = 'pointer'
  button.style.margin = '10px'
  button.style.fontFamily = 'Andale Mono'
  let cl: any = fn
  const onClick = () => {
    cl = cl()
    if (!cl) {
      button.style.backgroundColor = '#fff'
      button.style.color = '#000'
      cl = fn
    } else {
      button.style.backgroundColor = '#000'
      button.style.color = '#fff'
    }
  }
  if (isToggle) {
    window.requestAnimationFrame(() => {
      onClick()
    })
  }
  button.onclick = onClick
  buttonHolder.appendChild(button)
}

export const logs = (): ((...args: any[]) => void) => {
  const div = document.createElement('div')
  let logs: string[] = []
  div.style.padding = '16px'
  div.style.border = '2px solid #000'
  div.style.borderRadius = '4px'
  div.style.fontSize = '14px'
  div.style.fontWeight = 'bold'
  div.style.cursor = 'pointer'
  div.style.fontFamily = 'Andale Mono'
  div.style.height = '100%'
  div.style.margin = '10px'
  div.style.overflowY = 'scroll'
  div.onclick = () => {}
  document.body.appendChild(div)

  document.onkeydown = (e) => {
    const key = e.keyCode || e.charCode || 0
    if (e.metaKey && key === 75) {
      logs = []
      updateLog('cleared logs...')
    }
  }

  const updateLog = (...args) => {
    const d = new Date()
    logs.push(
      `<div style="margin-top:4px;margin-bottom:8px"><span style="font-size:12px;color:#ccc">${d.getHours()}:${padLeft(
        '' + d.getMinutes(),
        2,
        '0'
      )}:${padLeft('' + d.getSeconds(), 2, '0')}:${padLeft(
        '' + d.getMilliseconds(),
        3,
        '0'
      )}</span> ${args
        .map((v, i) => {
          if (v instanceof Error) {
            return `<span style="color:red;">${v.message}</span>`
          }
          if (typeof v === 'object') {
            return `<pre style="font-family:Andale Mono">${JSON.stringify(
              v,
              null,
              2
            )}</pre>`
          }
          return i % 2 ? v + ', ' : v + ': '
        })
        .join('')
        .slice(0, -2)}</div>`
    )

    if (logs.length > 250) {
      logs.shift()
    }

    div.innerHTML = logs.join('')

    div.scrollTop = div.scrollHeight
  }

  return updateLog
}