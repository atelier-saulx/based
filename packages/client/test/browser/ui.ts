import { padLeft } from '@saulx/utils'

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

export const uploadButton = (label: string, fn: (files: File[]) => void) => {
  const button = document.createElement('label')

  button.innerHTML = `<span style="cursor:pointer">${label}</span>
<input multiple type="file" style="display: none">`

  button.style.padding = '16px'
  button.style.border = '2px solid #000'
  button.style.borderRadius = '4px'
  button.style.fontSize = '14px'
  button.style.fontWeight = 'bold'
  button.style.cursor = 'pointer'
  button.style.margin = '10px'
  button.style.fontFamily = 'Andale Mono'

  button.children[1].addEventListener('input', () => {
    // @ts-ignore
    fn(button.children[1].files)
  })

  buttonHolder.appendChild(button)
}

export const toggleButton = (label: string, fn: () => () => void) => {
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
  button.onclick = () => {
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
        .map((v) => {
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
          return v
        })
        .join(': ')}</div>`
    )

    if (logs.length > 250) {
      logs.shift()
    }

    div.innerHTML = logs.join('')

    div.scrollTop = div.scrollHeight
  }

  return updateLog
}
