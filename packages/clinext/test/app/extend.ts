export const extend = (proto: HTMLElement) => {
  const setAttribute = proto.setAttribute
  if (setAttribute.name) {
    const removeAttribute = proto.removeAttribute
    const styles = new Map(
      Object.entries({
        flex: 'display:flex',
        column: 'flex-direction:column',
        relative: 'position:relative',
        absolute: 'position:absolute',
        center: 'align-items:center;justify-content:center',
        grow: 'flex-grow:1',
      }),
    )
    const h = 'height:'
    const w = 'width:'
    const fix = (v: string, offset: number) =>
      (v = v.slice(offset)) && /\d$/.test(v) ? v + 'px' : v
    const transformStyle = (v: string) => {
      v = v.trim()
      return (
        (/:/.test(v) && v) ||
        styles.get(v) ||
        (v[0] === 'h' && h + fix(v, 1)) ||
        (v[0] === 'w' && w + fix(v, 1)) ||
        (/^gap/.test(v) && 'gap:' + fix(v, 3)) ||
        (/^pad/.test(v) && 'padding:' + fix(v, 3)) ||
        (/vh$/.test(v) && h + v) ||
        (/vw$/.test(v) && w + v) ||
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
