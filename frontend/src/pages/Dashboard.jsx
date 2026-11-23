import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';

function Icon({ name }) {
  const paths = {
    plus: <><path d="M12 5v14M5 12h14"/></>,
    folder: <><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></>,
    check: <><path d="m5 12 4 4L19 6"/></>,
    chat: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></>,
    paper: <><path d="M14 2H6a2 2 0 0 0-2 2v16h16V8z"/><path d="M14 2v6h6M8 13h8M8 17h6"/></>,
  };
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState(null);
  const [metrics, setMetrics] = useState({ papers: 0, ready: 0, questions: 0 });
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    api('/workspaces')
      .then(async (d) => {
        setWorkspaces(d.workspaces);
        if (!d.workspaces.length) return;
        const details = await Promise.all(d.workspaces.map(async (ws) => {
          const [papers, questions] = await Promise.all([
            api(`/workspaces/${ws._id}/papers`).catch(() => ({ papers: [] })),
            api(`/workspaces/${ws._id}/questions`).catch(() => ({ questions: [] })),
          ]);
          return { papers: papers.papers, questions: questions.questions };
        }));
        setMetrics({
          papers: details.reduce((n, d) => n + d.papers.length, 0),
          ready: details.reduce((n, d) => n + d.papers.filter((p) => p.status === 'ready').length, 0),
          questions: details.reduce((n, d) => n + d.questions.length, 0),
        });
      })
      .catch((e) => setError(e.message));
  }, []);

  async function create(e) {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      const { workspace } = await api('/workspaces', { method: 'POST', body: { name, description } });
      setName('');
      setDescription('');
      setShowCreate(false);
      navigate(`/workspaces/${workspace._id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function remove(ws) {
    if (!confirm(`Delete "${ws.name}" and all ${ws.paperCount} paper(s) in it? This cannot be undone.`)) return;
    try {
      await api(`/workspaces/${ws._id}`, { method: 'DELETE' });
      setWorkspaces((list) => list.filter((w) => w._id !== ws._id));
      setMetrics((m) => ({ ...m, papers: Math.max(0, m.papers - ws.paperCount) }));
    } catch (err) {
      setError(err.message);
    }
  }

  const stats = [
    { label: 'Workspaces', value: workspaces?.length ?? '—', meta: 'Research projects', icon: 'folder' },
    { label: 'Research papers', value: metrics.papers, meta: 'Across all workspaces', icon: 'paper' },
    { label: 'Ready for AI', value: metrics.ready, meta: 'Processed papers', icon: 'check' },
    { label: 'Questions asked', value: metrics.questions, meta: 'Saved conversations', icon: 'chat' },
  ];

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Research overview</span>
          <h1>Good to see you, {user?.name?.split(' ')[0] || 'researcher'}.</h1>
          <p>Your research workspaces and document intelligence at a glance.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate((v) => !v)}>
          <Icon name="plus" /> New workspace
        </button>
      </div>

      {showCreate && (
        <form className="card create-form" onSubmit={create} style={{padding:16, marginBottom:16, display:'grid', gridTemplateColumns:'1fr 1.5fr auto', gap:10}}>
          <input className="input" placeholder="Workspace name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} />
          <input className="input" placeholder="Short description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
          <button className="btn-primary" disabled={creating}>{creating ? 'Creating…' : 'Create'}</button>
        </form>
      )}
      {error && <div className="card" style={{marginBottom:16,padding:'10px 12px',color:'#fca5a5',borderColor:'#7f1d1d'}}>{error}</div>}

      <div className="stats-grid">
        {stats.map((stat) => (
          <div className="card stat-card" key={stat.label}>
            <div className="stat-top"><span>{stat.label}</span><span style={{color:'#8b5cf6'}}><Icon name={stat.icon} /></span></div>
            <div className="stat-value">{stat.value}</div>
            <div className="stat-meta">{stat.meta}</div>
          </div>
        ))}
      </div>

      <div className="section-heading">
        <h2>Recent workspaces</h2>
        {workspaces?.length > 0 && <span style={{color:'#71717a',fontSize:11}}>{workspaces.length} total</span>}
      </div>

      {workspaces === null ? (
        <div className="empty-state"><span style={{color:'#71717a',fontSize:13}}>Loading workspaces…</span></div>
      ) : workspaces.length === 0 ? (
        <div className="empty-state">
          <div>
            <div className="empty-state-icon"><Icon name="folder" /></div>
            <h3 style={{margin:'0 0 6px',fontSize:15}}>Create your first research workspace</h3>
            <p style={{margin:0, color:'#71717a', fontSize:12}}>Organize papers by topic, then ask grounded questions across the documents.</p>
            <button className="btn-primary" style={{marginTop:16}} onClick={() => setShowCreate(true)}><Icon name="plus" /> Create workspace</button>
          </div>
        </div>
      ) : (
        <div className="workspace-grid">
          {workspaces.map((ws) => (
            <div className="card card-hover workspace-card" key={ws._id}>
              <div className="workspace-card-top">
                <Link to={`/workspaces/${ws._id}`} className="workspace-icon" aria-label={`Open ${ws.name}`}><Icon name="folder" /></Link>
                <button className="btn-ghost" style={{minHeight:28,padding:'0 7px',fontSize:10}} onClick={() => remove(ws)}>Delete</button>
              </div>
              <Link to={`/workspaces/${ws._id}`} style={{color:'inherit',textDecoration:'none'}}>
                <h3>{ws.name}</h3>
                <p>{ws.description || 'No description added.'}</p>
              </Link>
              <div className="workspace-meta">
                <span>{ws.paperCount} paper{ws.paperCount === 1 ? '' : 's'}</span>
                <span>Updated {new Date(ws.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
