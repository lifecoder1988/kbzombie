export const enum InputAction {
  LetterHit = 0,
  LetterMiss = 1,
  Space = 2,
  Ignore = 3,
}

const IGNORED_KEYS = new Set([
  'Shift', 'Control', 'Alt', 'Meta',
  'Escape', 'Tab', 'CapsLock', 'Enter', 'Backspace',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Delete', 'Insert', 'Home', 'End', 'PageUp', 'PageDown',
  'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
])

export function classifyInput(key: string, expectedLetter: string): InputAction {
  if (key === ' ') return InputAction.Space
  if (key.length > 1 || IGNORED_KEYS.has(key)) return InputAction.Ignore
  const lower = key.toLowerCase()
  if (lower === expectedLetter) return InputAction.LetterHit
  return InputAction.LetterMiss
}
