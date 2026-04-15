export interface Storage {
  save(key: string, data: unknown): void
  load<T>(key: string): T | null
  delete(key: string): void
}

export class LocalStorage implements Storage {
  save(key: string, data: unknown): void {
    try {
      window.localStorage.setItem(key, JSON.stringify(data))
    } catch {
      // localStorage 不可用（隐私模式等）时静默降级
    }
  }

  load<T>(key: string): T | null {
    try {
      const raw = window.localStorage.getItem(key)
      if (raw === null) return null
      return JSON.parse(raw) as T
    } catch {
      return null
    }
  }

  delete(key: string): void {
    try {
      window.localStorage.removeItem(key)
    } catch {
      // 静默降级
    }
  }
}
