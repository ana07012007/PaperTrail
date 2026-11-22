import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../auth';

export function Logo() {
  return (
    <span className="brand-name">
      PaperTrail <span>AI</span>
    </span>
  );
}

function Icon({ name, className = 'nav-icon' }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    library: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></>,
    upload: <><path d="M12 16V3"/><path d="m7 8 5-5 5 5"/><path d="M5 15v4h14v-4"/></>,
    chat: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></>,
    compare: <><path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3"/><path d="M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3"/><path d="M12 4v16"/></>,
    folder: <><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16"/></>,
    chevron: <><path d="m9 18 6-6-6-6"/></>,
  };
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => setMobileOpen(false), [location.pathname]);

  const pageTitle = location.pathname === '/' ? 'Overview'
    : location.pathname.startsWith('/workspaces') ? 'Research workspace'
    : 'PaperTrail';

  return (
    <>
      {mobileOpen && <button className="overlay" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-brand">
          <Link to="/" className="brand-mark" title="PaperTrail AI">PT</Link>
          <Logo />
          <button className="btn-ghost" style={{marginLeft:'auto', padding:0, minHeight:32, width:32}} onClick={() => setCollapsed((v) => !v)} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            <Icon name="chevron" className="nav-icon" />
          </button>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-section">Workspace</div>
          <NavLink to="/" end className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`} title="Overview">
            <Icon name="grid" /><span className="nav-label">Overview</span>
          </NavLink>
          <NavLink to="/" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`} title="Research library">
            <Icon name="library" /><span className="nav-label">Research library</span>
          </NavLink>
          {location.pathname.startsWith('/workspaces/') && (
            <>
              <div className="nav-section">Research</div>
              <NavLink to={location.pathname} className="nav-link active" title="AI assistant">
                <Icon name="chat" /><span className="nav-label">AI assistant</span>
              </NavLink>
              <NavLink to={location.pathname} className="nav-link" title="Upload papers">
                <Icon name="upload" /><span className="nav-label">Upload papers</span>
              </NavLink>
              <span className="nav-link" title="Paper comparison is available after backend support" style={{opacity:.5}}>
                <Icon name="compare" /><span className="nav-label">Compare papers · Soon</span>
              </span>
              <span className="nav-link" title="Collections are available after backend support" style={{opacity:.5}}>
                <Icon name="folder" /><span className="nav-label">Collections · Soon</span>
              </span>
            </>
          )}
        </nav>
        <div className="sidebar-footer">
          <button className="profile-button" onClick={logout} title="Log out">
            <span className="avatar">{(user?.name || user?.email || 'U').slice(0,2).toUpperCase()}</span>
            <span className="profile-copy"><strong>{user?.name || 'User'}</strong><span>{user?.email}</span></span>
          </button>
        </div>
      </aside>
      <header className="topbar">
        <button className="topbar-action mobile-menu" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Icon name="menu" /></button>
        <span className="topbar-title">{pageTitle}</span>
        <button className="topbar-action" title="Notifications" aria-label="Notifications" disabled style={{opacity:.45}}><Icon name="bell" /></button>
      </header>
    </>
  );
}
