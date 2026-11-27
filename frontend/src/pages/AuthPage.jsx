import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { closestAllowedEmail, emailFormatError, emailTypoSuggestion } from '../utils/email';
import { PASSWORD_RULES, passwordError } from '../utils/password';

/**
 * Domain problem with a well-formed sign-up email, or null if it is fine.
 * allowed: list from the server (only these may sign up), null (any domain), or undefined (not loaded yet).
 */
function emailDomainIssue(email, allowed) {
  if (Array.isArray(allowed)) {
    const domain = email.split('@')[1];
    if (allowed.includes(domain)) return null;
    return { domain, suggestion: closestAllowedEmail(email, allowed), notAccepted: true };
  }
  const suggestion = emailTypoSuggestion(email);
  return suggestion ? { suggestion } : null;
}

export default function AuthPage({ mode }) {
  const isLogin = mode === 'login';
  const { login, register, googleLogin } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  // Sign-up only: the checklist appears once the user starts typing a password.
  const showPasswordRules = !isLogin && (passwordTouched || form.password.length > 0);

  // Sign-up only: existing accounts keep logging in with whatever email they registered with.
  const normalizedEmail = form.email.trim().toLowerCase();
  const [allowedDomains, setAllowedDomains] = useState(undefined);
  const emailError = !isLogin && emailTouched ? emailFormatError(normalizedEmail) : null;
  const emailIssue = !isLogin && emailTouched && !emailError ? emailDomainIssue(normalizedEmail, allowedDomains) : null;
  const emailSuggestion = emailIssue?.suggestion || null;

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  useEffect(() => {
    if (isLogin) return;
    // If this fails the server still enforces the list; the form just checks less up front.
    api('/auth/email-rules').then((d) => setAllowedDomains(d.allowedDomains)).catch(() => {});
  }, [isLogin]);

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
    const email = form.email.trim().toLowerCase();
    if (!isLogin && (emailFormatError(email) || emailDomainIssue(email, allowedDomains))) {
      setEmailTouched(true);
      return;
    }
    if (!isLogin && passwordError(form.password)) {
      setPasswordTouched(true);
      setError(passwordError(form.password));
      return;
    }
    setBusy(true);
    try {
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
        <form className="auth-form" onSubmit={submit} noValidate={!isLogin}>
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
            <input className="input" type="email" value={form.email} onChange={set('email')} onBlur={() => setEmailTouched(true)}
              required autoComplete="email" placeholder="you@company.com"
              aria-invalid={emailError || emailIssue ? 'true' : undefined}
              aria-describedby={emailError || emailIssue ? 'email-error' : undefined}
              style={emailError || emailIssue ? {borderColor:'#b91c1c'} : undefined} />
            {emailError && <span id="email-error" role="alert" style={{display:'block',marginTop:6,color:'#fca5a5',fontSize:12,fontWeight:400}}>{emailError}</span>}
            {emailIssue?.notAccepted && !emailSuggestion && (
              <span id="email-error" role="alert" style={{display:'block',marginTop:6,color:'#fca5a5',fontSize:12,fontWeight:400}}>
                “{emailIssue.domain}” isn't accepted. Please use Gmail, Outlook, Yahoo, iCloud or another major provider.
                <details style={{marginTop:4,color:'#a1a1aa'}}>
                  <summary style={{cursor:'pointer',color:'#c4b5fd'}}>See accepted email providers</summary>
                  <span style={{display:'block',marginTop:4,lineHeight:1.6}}>{allowedDomains.join(', ')}</span>
                </details>
              </span>
            )}
            {emailSuggestion && (
              <span id="email-error" role="alert" style={{display:'block',marginTop:6,color:'#fca5a5',fontSize:12,fontWeight:400}}>
                Did you mean{' '}
                <button type="button" onClick={() => setForm((current) => ({ ...current, email: emailSuggestion }))}
                  style={{border:0,padding:0,background:'none',color:'#c4b5fd',fontSize:12,fontWeight:700,textDecoration:'underline',cursor:'pointer'}}>
                  {emailSuggestion}
                </button>?
              </span>
            )}
          </label>
          <label className="auth-field">Password
            <input className="input" type="password" value={form.password} onChange={set('password')} onBlur={() => setPasswordTouched(true)}
              required minLength={isLogin ? undefined : 8} autoComplete={isLogin ? 'current-password' : 'new-password'}
              placeholder={isLogin ? 'Enter your password' : 'Letters, numbers and a special character'}
              aria-describedby={showPasswordRules ? 'password-rules' : undefined} />
            {showPasswordRules && (
              <ul id="password-rules" aria-live="polite" style={{listStyle:'none',margin:'8px 0 0',padding:0,display:'grid',gap:3,fontSize:12,fontWeight:400}}>
                {PASSWORD_RULES.map((rule) => {
                  const ok = rule.test(form.password);
                  return (
                    <li key={rule.label} style={{color: ok ? '#86efac' : passwordTouched ? '#fca5a5' : '#a1a1aa'}}>
                      <span aria-hidden="true" style={{display:'inline-block',width:16}}>{ok ? '✓' : '•'}</span>
                      {rule.label}<span className="sr-only">{ok ? ' – done' : ' – not yet'}</span>
                    </li>
                  );
                })}
              </ul>
            )}
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
