import { Form } from 'react-bootstrap'
import './index.css'
import { useCallback, useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { Button } from 'react-bootstrap'
import {
  signup,
  login,
  logout as serverLogout,
  saveToken,
  loadToken,
  postSearch,
  getHistory,
  getPagedHistory,
  clearHistory,
  getTopSearches,
} from './api'

const UNSPLASH_API = 'https://api.unsplash.com/search/photos';
const PER_PAGE = 16;

function App() {
  const searchInput = useRef(null);
  const [images, setImages] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [, setErrorMsg] = useState('');

  // selection state for images
  const [selectedImages, setSelectedImages] = useState(new Set());

  // handle token returned from OAuth redirect (e.g., ?token=...)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const t = params.get('token');
      const name = params.get('name');
      if (t) {
        saveToken(t);
        setToken(t);
        if (name) setUser({ name });
        // remove token from URL
        params.delete('token');
        params.delete('name');
        const newQuery = params.toString();
        const newUrl = window.location.pathname + (newQuery ? `?${newQuery}` : '');
        window.history.replaceState({}, '', newUrl);
      }
    } catch (err) {
      // no-op
    }
  }, []);

  // auth state
  const [token, setToken] = useState(loadToken());
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });

  // history
  const [, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const historyRef = useRef(null);
  const topActionsRef = useRef(null);
  const [topSearches, setTopSearches] = useState([]);

  // close history when clicking outside or pressing Escape
  useEffect(() => {
    function onDocClick(e) {
      if (!showHistory) return;
      const h = historyRef.current;
      const t = topActionsRef.current;
      if (h && h.contains(e.target)) return; // click inside history
      if (t && t.contains(e.target)) return; // click on buttons
      setShowHistory(false);
    }

    function onKey(e) {
      if (e.key === 'Escape') setShowHistory(false);
    }

    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [showHistory]);

  const fetchImages = useCallback(async () => {
    try {
      const q = searchInput.current?.value || '';
      if (!q) return setImages([]);
      setErrorMsg('');
      const { data } = await axios.get(`${UNSPLASH_API}?query=${encodeURIComponent(q)}&page=${page}&per_page=${PER_PAGE}&client_id=${import.meta.env.VITE_API_KEY}`);
      setImages(data.results);
      setTotalPages(data.total_pages);
    } catch (error) {
      setErrorMsg('Failed to fetch images. Please try again later.');
      console.error('Error fetching images:', error);
    }
  }, [page]);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  // fetch top searches banner (public)
  useEffect(() => {
    let mounted = true;
    async function loadTop() {
      try {
        const res = await getTopSearches();
        if (!mounted) return;
        if (res && res.top) setTopSearches(res.top);
      } catch (err) {
        console.warn('Failed to load top searches', err && err.message);
      }
    }
    loadTop();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    // try to load history if logged in
    if (token) {
      fetchHistory();
      // naive decode of token to set user id/email not implemented; server returns user object on login/signup
    }
  }, [token]);

  const fetchHistory = async () => {
    try {
      const res = await getPagedHistory({ page: 1, limit: 100 });
      if (res && res.history) {
        setHistoryList(res.history);
        setHistoryTotal(res.total || res.history.length || 0);
        setHistoryPage(res.page || 1);
      }
    } catch (e) {
      console.error('Failed to fetch history', e);
    }
  }

  const loadHistoryPage = async (pageNum = 1) => {
    try {
      const res = await getPagedHistory({ page: pageNum, limit: 50 });
      if (res && res.history) {
        setHistoryList(res.history);
        setHistoryTotal(res.total || res.history.length || 0);
        setHistoryPage(res.page || 1);
      }
    } catch (err) {
      console.error('Failed to load history page', err);
    }
  };

  const handleClearHistory = async () => {
    if (!confirm('Clear all search history?')) return;
    try {
      await clearHistory();
      setHistoryList([]);
      setHistoryTotal(0);
      setShowHistory(false);
    } catch (err) {
      console.error('Failed to clear history', err);
      alert('Failed to clear history');
    }
  };

  const resetPage = () => {
    setPage(1);
    fetchImages();
  }

  const handleSearch = async (event) => {
    if (event) event.preventDefault();
    const term = searchInput.current?.value || '';
    if (!term) return;
    resetPage();
    // store term on server if logged in
    if (token) {
      try {
        await postSearch(term);
        fetchHistory();
      } catch (e) {
        console.error('Failed to save search', e);
      }
    }
  }

  const handleSelection = (selection) => {
    if (searchInput.current) searchInput.current.value = selection;
    handleSearch();
  }

  const toggleSelectImage = (id) => {
    setSelectedImages(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const [downloading, setDownloading] = useState(false);

  const downloadSelected = async () => {
    const ids = Array.from(selectedImages);
    if (!ids.length) return;
    const selected = images.filter(img => ids.includes(img.id));
    setDownloading(true);
    try {
      // download sequentially to avoid hammering network
      for (const img of selected) {
        const url = img.urls.full || img.urls.raw || img.urls.regular || img.urls.small;
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error('Failed to fetch');
          const blob = await res.blob();
          const ext = (blob.type && blob.type.split('/')[1]) || 'jpg';
          const filename = `${img.id}.${ext}`;
          const objUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = objUrl;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          a.remove();
          // revoke after a short delay to ensure download started
          setTimeout(() => URL.revokeObjectURL(objUrl), 15000);
        } catch (err) {
          console.error('Failed to download image', img.id, err);
        }
      }
    } finally {
      setDownloading(false);
    }
  }

  const clearSelection = () => {
    setSelectedImages(new Set());
  }

  // auth handlers
  const handleAuthChange = (e) => setAuthForm({ ...authForm, [e.target.name]: e.target.value });

  const handleSignup = async (e) => {
    e.preventDefault();
    try {
      const data = await signup(authForm);
      if (data.token) {
        saveToken(data.token);
        setToken(data.token);
        setUser(data.user || null);
      }
    } catch (err) {
      console.error('Signup error', err);
      alert(err?.response?.data?.message || 'Signup failed');
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const data = await login({ email: authForm.email, password: authForm.password });
      if (data.token) {
        saveToken(data.token);
        setToken(data.token);
        setUser(data.user || null);
      }
    } catch (err) {
      console.error('Login error', err);
      alert(err?.response?.data?.message || 'Login failed');
    }
  }

  const handleLogout = async () => {
    try {
      await serverLogout();
    } catch (err) { console.warn('logout failed', err && err.message); }
    setToken(null);
    setUser(null);
  }

  // If not logged in, show a centered auth page first
  if (!token) {
    return (
      <div className='auth-screen container'>
        <h1 className='title'>Image Search</h1>
        <div className='auth-panel'>
          <div className='auth-toggle' style={{ marginBottom: 12 }}>
            <button className={`btn btn-sm ${authMode === 'login' ? 'btn-primary' : 'btn-light'}`} onClick={() => setAuthMode('login')}>Login</button>
            <button className={`btn btn-sm ${authMode === 'signup' ? 'btn-primary' : 'btn-light'}`} onClick={() => setAuthMode('signup')}>Signup</button>
          </div>

          {authMode === 'signup' ? (
            <form className='auth-form' onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input name='name' placeholder='Name' value={authForm.name} onChange={handleAuthChange} className='form-control' />
              <input name='email' placeholder='Email' value={authForm.email} onChange={handleAuthChange} className='form-control' />
              <input name='password' placeholder='Password' type='password' value={authForm.password} onChange={handleAuthChange} className='form-control' />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className='btn btn-success' type='submit'>Create account</button>
                <button type='button' className='btn btn-light' onClick={() => setAuthMode('login')}>Have an account?</button>
              </div>
            </form>
          ) : (
            <form className='auth-form' onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input name='email' placeholder='Email' value={authForm.email} onChange={handleAuthChange} className='form-control' />
              <input name='password' placeholder='Password' type='password' value={authForm.password} onChange={handleAuthChange} className='form-control' />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className='btn btn-primary' type='submit'>Login</button>
                <button type='button' className='btn btn-light' onClick={() => setAuthMode('signup')}>Create account</button>
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'center' }}>
                <a className='oauth-btn oauth-google' href={`${import.meta.env.VITE_SERVER_URL || 'http://localhost:5000'}/api/auth/google`}>Sign in with Google</a>
                <a className='oauth-btn oauth-github' href={`${import.meta.env.VITE_SERVER_URL || 'http://localhost:5000'}/api/auth/github`}>GitHub</a>
                <a className='oauth-btn oauth-fb' href={`${import.meta.env.VITE_SERVER_URL || 'http://localhost:5000'}/api/auth/facebook`}>Facebook</a>
              </div>
            </form>
          )}
        </div>
      </div>
    )
  }

  // Logged-in UI: clean centered search layout (matches provided mock)
  return (
    <div className='container main-screen'>
      <div style={{ position: 'relative', width: '100%' }}>
        <div className='top-actions' ref={topActionsRef}>
          <button className='btn btn-sm btn-history' onClick={() => setShowHistory(prev => { const next = !prev; if (next) loadHistoryPage(1); return next; })}>History</button>
          <button className='btn btn-sm btn-history' onClick={handleLogout}>Logout</button>
        </div>
      </div>

      {topSearches && topSearches.length > 0 && (
        <div className='top-searches-banner'>
          <div className='banner-inner'>
            <strong>Top searches:</strong>
            {topSearches.map((t) => (
              <button key={t.term} className='btn btn-sm btn-light term-pill' onClick={() => { if (searchInput.current) searchInput.current.value = t.term; handleSearch(); }}>
                {t.term} <span className='count'>({t.count})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <h1 className='title title-large'>Image Search</h1>

      <div className='main-search'>
        <Form onSubmit={handleSearch} className='search-form'>
          <Form.Control className='search-input large' type='search' placeholder='Type something to search...' ref={searchInput} />
          <Button variant='primary' className='search-btn' onClick={handleSearch}>Search</Button>
        </Form>

        <div className='filters filters-centered'>
          <div onClick={() => handleSelection('Nature')}>Nature</div>
          <div onClick={() => handleSelection('Bird')}>Birds</div>
          <div onClick={() => handleSelection('Cats')}>Cats</div>
          <div onClick={() => handleSelection('Shoes')}>Shoes</div>
        </div>
      </div>

      {/* Image grid below the centered search */}
      {showHistory && (
        <div className='history-dropdown' ref={historyRef}>
          <div className='history-header'>
            <strong>Your searches</strong>
            <div style={{ marginLeft: 'auto' }}>
              <button className='btn btn-sm btn-light' onClick={handleClearHistory}>Clear</button>
            </div>
          </div>
          <div className='history-list'>
            {historyList.length ? (
              <ul>
                {historyList.map(h => (
                  <li key={h.id} onClick={() => { if (searchInput.current) searchInput.current.value = h.term; handleSearch(); setShowHistory(false); }}>
                    <div className='term'>{h.term}</div>
                    <div className='small'>{new Date(h.createdAt).toLocaleString()}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className='small' style={{ padding: 12 }}>No searches yet</div>
            )}
          </div>
          <div className='history-footer'>
            {historyPage > 1 && <button className='btn btn-sm btn-light' onClick={() => loadHistoryPage(historyPage - 1)}>Prev</button>}
            <span style={{ margin: '0 8px' }}>Page {historyPage}</span>
            {historyList.length >= 50 && <button className='btn btn-sm btn-light' onClick={() => loadHistoryPage(historyPage + 1)}>Next</button>}
          </div>
        </div>
      )}

      <div style={{ marginTop: '2.5rem', width: '100%' }}>
        {selectedImages.size > 0 && (
          <div className='selected-counter selection-actions'>
            <div>Selected: {selectedImages.size} images</div>
            <div style={{ marginLeft: 12 }}>
              <button className='btn btn-sm btn-history' onClick={downloadSelected} disabled={downloading}>{downloading ? 'Downloading...' : 'Download Selected'}</button>
              <button className='btn btn-sm btn-ghost' onClick={clearSelection} style={{ marginLeft: 8 }}>Clear</button>
            </div>
          </div>
        )}
        <div className='images' style={{ marginTop: '1rem' }}>
          {images.map((image) => (
            <div
              key={image.id}
              className={`image-card ${selectedImages.has(image.id) ? 'selected' : ''}`}
              onClick={() => toggleSelectImage(image.id)}
              role='button'
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSelectImage(image.id); } }}
            >
              <img src={image.urls.small} alt={image.alt_description} className='image' />
              {selectedImages.has(image.id) && <div className='selected-badge'>✓</div>}
            </div>
          ))}
        </div>
      </div>

      <div className='buttons'>
        {page > 1 && <Button onClick={() => { setPage(page - 1); }}>Previous</Button>}
        {page < totalPages && <Button onClick={() => { setPage(page + 1); }}>Next</Button>}
      </div>
    </div>
  )
}

export default App;
