import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import Navbar from './components/Navbar';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import WorkspacePage from './pages/WorkspacePage';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{padding:40,textAlign:'center',color:'#a1a1aa'}}>Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <div className="app-shell"><Navbar /><main className="content-area">{children}</main></div>;
}

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <AuthPage mode="login" />} />
      <Route path="/register" element={user ? <Navigate to="/" replace /> : <AuthPage mode="register" />} />
      <Route path="/" element={<Protected><Dashboard /></Protected>} />
      <Route path="/workspaces/:id" element={<Protected><WorkspacePage /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
