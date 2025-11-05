import axios from 'axios';


const SERVER_URL ='https://unsplash-image-search-app.onrender.com';

const api = axios.create({ baseURL: SERVER_URL });


export function setAuthToken(token) {
  if (token) api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  else delete api.defaults.headers.common['Authorization'];
}

export function saveToken(token) {
  localStorage.setItem('token', token);
  setAuthToken(token);
}

export function loadToken() {
  const t = localStorage.getItem('token');
  setAuthToken(t);
  return t;
}

export function clearToken() {
  localStorage.removeItem('token');
  setAuthToken(null);
}

export async function signup({ name, email, password }) {
  const res = await api.post('/api/auth/signup', { name, email, password });
  return res.data;
}

export async function login({ email, password }) {
  const res = await api.post('/api/auth/login', { email, password });
  return res.data;
}

export async function logout() {
  // call server logout to blacklist token (in-memory)
  try { await api.post('/api/auth/logout'); } catch (err) { console.warn('logout request failed', err && err.message); }
  clearToken();
}

export async function postSearch(term) {
  const res = await api.post('/api/search', { term });
  return res.data;
}

export async function getHistory() {
  const res = await api.get('/api/search/history');
  return res.data;
}

export async function getPagedHistory({ page = 1, limit = 50, q = '' } = {}) {
  const params = { page, limit };
  if (q) params.q = q;
  const res = await api.get('/api/search', { params });
  return res.data;
}

export async function clearHistory() {
  const res = await api.delete('/api/search');
  return res.data;
}

export async function getTopSearches() {
  const res = await api.get('/api/top-searches');
  return res.data;
}

export default api;
