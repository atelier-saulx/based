export const flex = ['flex', 'display:flex']

export const extend = (proto: HTMLElement) => {
  const setAttribute = proto.setAttribute
  if (setAttribute.name) {
    const removeAttribute = proto.removeAttribute
    const fix = (v: string, offset: number) => {
      const val = v.slice(offset)
      return /\d$/.test(val) ? val + 'px' : val
    }

    let flex: 1 | 2
    let abs: 1 | 2
    const transformStyle = (v: string) => {
      v = v.trim()
      if (/:/.test(v)) {
        if (/^(inset|top|left|right|bottom)/.test(v)) {
          abs ??= 1
        }
        return v
      }
      switch (v) {
        case 'absolute':
        case 'relative':
          abs = 2
          return 'position:' + v
        case 'flex':
          flex = 2
          return 'display:' + v
        case 'column':
        case 'row':
          flex ??= 1
          return 'flex-direction:' + v
        case 'center':
        case 'flex-start':
        case 'flex-end':
          flex ??= 1
          return `align-items:${v};justify-content:${v}`
      }
      return (
        (v[0] === 'h' && 'height:' + fix(v, 1)) ||
        (v[0] === 'w' && 'width:' + fix(v, 1)) ||
        (/^pad/.test(v) && 'padding:' + fix(v, 3)) ||
        (/^gap/.test(v) && (flex ??= 1) && 'gap:' + fix(v, 3)) ||
        (/^grow/.test(v) && (flex ??= 1) && 'flex-grow:' + (v.slice(4) || 1)) ||
        (/^shrink/.test(v) && (flex ??= 1) && 'flex-shrink:' + v.slice(6)) ||
        (/vh$/.test(v) && 'height:' + v) ||
        (/vw$/.test(v) && 'width:' + v) ||
        console.warn('unexpected style- value:', v) ||
        'outline:10px dotted red'
      )
    }
    proto.setAttribute = function (k, v) {
      if (k.at(-1) === '-') {
        if (k === 'html-') {
          this.innerHTML = v
        } else if (k === 'style-') {
          v = v.replace(/[^;]+/g, transformStyle)
          if (flex) {
            if (flex === 1) {
              v = 'display:flex;' + v
            }
            flex = null
          }
          if (abs) {
            if (abs === 1) {
              v = 'position:absolute;' + v
            }
            abs = null
          }
          setAttribute.call(this, 'style', v)
        } else {
          this.style[k.slice(0, -1)] = v
        }
      } else {
        setAttribute.call(this, k, v)
      }
    }

    proto.removeAttribute = function (k) {
      if (k.at(-1) === '-') {
        if (k === 'html-') {
          this.innerHTML = null
        } else if (k === 'style-') {
          removeAttribute.call(this, 'style', null)
        } else {
          this.style[k.slice(0, -1)] = null
        }
      } else {
        removeAttribute.call(this, k)
      }
    }
  }
}
