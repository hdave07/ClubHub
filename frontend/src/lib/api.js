import axios from 'axios'

export const api = axios.create({
  baseURL: '/api',
})

/**
 * @param {string} blurb
 * @returns {Promise<{outcomes: string[], clubs: Array<{id: string, name: string, summary: string, outcomes: string[], tags: string[], why_it_fits: string}>}>}
 */
export async function recommend(blurb) {
  const { data } = await api.post('/recommend', { blurb })
  return data
}
