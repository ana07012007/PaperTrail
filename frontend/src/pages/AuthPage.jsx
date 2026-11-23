import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth';

export default function AuthPage({ mode }) {
  const isLogin = mode === 'login';
  const { login, register, googleLogin } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) return;

    let interval;
    function initializeGoogle() {
      if (!window.google) return;
      clearInterval(interval);
      if (!window.__papertrailGoogleInitialized) {
        window.__papertrailGoogleInitialized = true;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async ({ credential }) => {
            setError('');
            setBusy(true);
            try {
              await googleLogin(credential);
            } catch (err) {
              setError(err.message);
            } finally {
              setBusy(false);
            }
          },
        });
      }
      window.google.accounts.id.renderButton(document.getElementById('google-signin'), {
        theme: 'outline',
        size: 'large',
        width: 380,
        text: isLogin ? 'signin_with' : 'signup_with',
      });
    }
    initializeGoogle();
    interval = window.setInterval(initializeGoogle, 100);
    return () => clearInterval(interval);
  }, [googleLogin, isLogin]);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const email = form.email.trim().toLowerCase();
      if (isLogin) await login(email, form.password);
      else await register(form.name.trim(), email, form.password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-showcase">
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span className="brand-mark">PT</span>
          <span style={{fontSize:14,fontWeight:750}}>PaperTrail <span style={{color:'#a78bfa'}}>AI</span></span>
        </div>
        <div style={{position:'relative',zIndex:1,maxWidth:560}}>
          <div className="eyebrow">Research intelligence</div>
          <h1 style={{margin:'12px 0 14px',fontSize:44,lineHeight:1.08,letterSpacing:'-.045em'}}>Read the literature.<br />Find the answer.</h1>
          <p style={{maxWidth:480,margin:0,color:'#a1a1aa',fontSize:15,lineHeight:1.7}}>
            Upload research papers, ground every answer in the source, and move through evidence with citations and page context.
          </p>
          <div style={{marginTop:28,display:'flex',gap:8,flexWrap:'wrap'}}>
            {['PDF processing','RAG answers','Source citations','Workspace research'].map((item) => (
              <span key={item} style={{border:'1px solid #27272a',borderRadius:999,padding:'6px 9px',color:'#d4d4d8',background:'#111114',fontSize:11}}>{item}</span>
            ))}
          </div>
        </div>
        <span style={{position:'relative',zIndex:1,color:'#52525b',fontSize:11}}>PaperTrail AI · Research workspace</span>
      </section>

      <section className="auth-panel">
        <form className="auth-form" onSubmit={submit}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <span className="brand-mark" style={{width:38,height:38}}>PT</span>
            <span style={{fontWeight:750}}>PaperTrail AI</span>
          </div>
          <h1>{isLogin ? 'Welcome back' : 'Create an account'}</h1>
          <p className="subtitle">{isLogin ? 'Continue to your research workspace.' : 'Start organizing and questioning your literature.'}</p>

          {!isLogin && (
            <label className="auth-field">Name
              <input className="input" value={form.name} onChange={set('name')} required autoComplete="name" placeholder="Your name" />
            </label>
          )}
          <label className="auth-field">Email
            <input className="input" type="email" value={form.email} onChange={set('email')} required autoComplete="email" placeholder="you@company.com" />
          </label>
          <label className="auth-field">Password
            <input className="input" type="password" value={form.password} onChange={set('password')} required minLength={isLogin ? undefined : 8} autoComplete={isLogin ? 'current-password' : 'new-password'} placeholder={isLogin ? 'Enter your password' : 'At least 8 characters'} />
          </label>

          {error && <div style={{marginTop:14,border:'1px solid #7f1d1d',borderRadius:8,background:'rgba(127,29,29,.12)',padding:'9px 10px',color:'#fca5a5',fontSize:12}}>{error}</div>}

          <button className="btn-primary" style={{width:'100%',marginTop:18}} disabled={busy}>
            {busy ? 'Please wait…' : isLogin ? 'Log in' : 'Create account'}
          </button>

          <div className="auth-divider"><span>or continue with</span></div>
          <div id="google-signin" style={{display:'flex',justifyContent:'center',minHeight:40}} />

          <p style={{margin:'18px 0 0',textAlign:'center',color:'#71717a',fontSize:12}}>
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <Link style={{color:'#c4b5fd',textDecoration:'none',fontWeight:700}} to={isLogin ? '/register' : '/login'}>
              {isLogin ? 'Sign up' : 'Log in'}
            </Link>
          </p>
        </form>
      </section>
    </main>
  );
}
