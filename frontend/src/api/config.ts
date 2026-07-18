const DEFAULT_API_BASE_URL = 'https://thap-rua-clinical-copilot.onrender.com/api/v1'

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/+$/, '')
