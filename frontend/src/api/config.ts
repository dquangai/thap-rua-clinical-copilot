// Dev server goi backend local; build production dung backend Render.
const DEFAULT_API_BASE_URL = import.meta.env.DEV
  ? 'http://127.0.0.1:4000/api/v1'
  : 'https://thap-rua-clinical-copilot.onrender.com/api/v1'

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/+$/, '')
