import type { ApiAdapter } from './types'

let api: ApiAdapter

if (import.meta.env.VITE_TARGET === 'electron') {
  api = window.api as ApiAdapter
} else {
  const { webAdapter } = await import('./web-adapter')
  api = webAdapter
}

export { api }
