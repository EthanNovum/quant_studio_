import api from './api'

export const authApi = {
  login: async (password: string) => {
    const response = await api.post('/auth/login', { password })
    return response.data
  },

  logout: async () => {
    const response = await api.post('/auth/logout')
    return response.data
  },

  check: async () => {
    const response = await api.get('/auth/check')
    return response.data as { authenticated: boolean }
  },
}
