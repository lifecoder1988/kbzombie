// src/engine/InputManager.ts
import type { InputEvent, InputListener } from './types'

export class InputManager {
  private listeners: Set<InputListener> = new Set()
  private composing = false  // 中文输入法状态
  private pressedKeys: Set<string> = new Set()

  /** 绑定浏览器事件。无头测试时不调用此方法。 */
  attach(target: EventTarget): void {
    target.addEventListener('keydown', this.onKeyDown as EventListener)
    target.addEventListener('keyup', this.onKeyUp as EventListener)
    target.addEventListener('compositionstart', this.onCompositionStart as EventListener)
    target.addEventListener('compositionend', this.onCompositionEnd as EventListener)
  }

  detach(target: EventTarget): void {
    target.removeEventListener('keydown', this.onKeyDown as EventListener)
    target.removeEventListener('keyup', this.onKeyUp as EventListener)
    target.removeEventListener('compositionstart', this.onCompositionStart as EventListener)
    target.removeEventListener('compositionend', this.onCompositionEnd as EventListener)
  }

  /** 注册监听器 */
  addListener(listener: InputListener): void {
    this.listeners.add(listener)
  }

  removeListener(listener: InputListener): void {
    this.listeners.delete(listener)
  }

  /** 手动注入输入事件（用于测试或脚本化输入） */
  inject(event: InputEvent): void {
    this.dispatch(event)
  }

  /** 查询某个键是否正在按下 */
  isKeyPressed(key: string): boolean {
    return this.pressedKeys.has(key)
  }

  private dispatch(event: InputEvent): void {
    if (event.type === 'keydown') {
      this.pressedKeys.add(event.key)
    } else {
      this.pressedKeys.delete(event.key)
    }
    for (const listener of this.listeners) {
      listener(event)
    }
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.composing) return
    if (e.repeat) return
    e.preventDefault()
    this.dispatch({
      key: e.key,
      type: 'keydown',
      timestamp: e.timeStamp,
    })
  }

  private onKeyUp = (e: KeyboardEvent): void => {
    if (this.composing) return
    this.dispatch({
      key: e.key,
      type: 'keyup',
      timestamp: e.timeStamp,
    })
  }

  private onCompositionStart = (): void => {
    this.composing = true
  }

  private onCompositionEnd = (): void => {
    this.composing = false
  }
}
