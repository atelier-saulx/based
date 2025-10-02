import { useInput } from 'ink'

export const useScrollInput = (
  selected: number,
  setSelected: (selected: number) => void,
  disabled = false,
) => {
  useInput((input, key) => {
    if (disabled) {
      return
    }
    let newSelected = selected
    const speed = key.meta ? 100 : key.shift ? 10 : 1
    if (key.upArrow) {
      newSelected = selected + speed
    }
    if (key.downArrow) {
      newSelected = selected - speed
    }
    if (newSelected < 0) {
      newSelected = 0
    }
    if (input === 'f') {
      newSelected = 0
    }
    setSelected(newSelected)
  })
}
