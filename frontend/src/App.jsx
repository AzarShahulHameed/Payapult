import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useEffect } from 'react';
import useStore from './store/useStore';
import { NAV } from './constants';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import PayRuns from './pages/PayRuns';
import Payslips from './pages/Payslips';
import Analytics from './pages/Analytics';
import Leave from './pages/Leave';
import Loans from './pages/Loans';
import Advances from './pages/Advances';
import Documents from './pages/Documents';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';

function ProtectedLayout({ children }) {
  const { isAuthenticated, refreshUser } = useStore();
  useEffect(() => { if (isAuthenticated) refreshUser(); }, []);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return (
    <div style={{ display:'flex',height:'100vh',overflow:'hidden',background:'#F4F7FB' }}>
      <Sidebar />
      <div style={{ flex:1,display:'flex',flexDirection:'column',overflow:'hidden' }}>
        <TopBar />
        <main style={{ flex:1,overflowY:'auto',padding:'28px 32px' }}>{children}</main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}body{font-family:'DM Sans',sans-serif;background:#F4F7FB}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:#D9E4EF;border-radius:3px}button{font-family:'DM Sans',sans-serif}`}</style>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{ style:{fontFamily:'DM Sans,sans-serif',fontSize:13,borderRadius:10} }} />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedLayout><Dashboard /></ProtectedLayout>} />
          <Route path="/employees" element={<ProtectedLayout><Employees /></ProtectedLayout>} />
          <Route path="/pay-runs" element={<ProtectedLayout><PayRuns /></ProtectedLayout>} />
          <Route path="/payslips" element={<ProtectedLayout><Payslips /></ProtectedLayout>} />
          <Route path="/analytics" element={<ProtectedLayout><Analytics /></ProtectedLayout>} />
          <Route path="/leave" element={<ProtectedLayout><Leave /></ProtectedLayout>} />
          <Route path="/loans" element={<ProtectedLayout><Loans /></ProtectedLayout>} />
          <Route path="/advances" element={<ProtectedLayout><Advances /></ProtectedLayout>} />
          <Route path="/documents" element={<ProtectedLayout><Documents /></ProtectedLayout>} />
          <Route path="/reports" element={<ProtectedLayout><Reports /></ProtectedLayout>} />
          <Route path="/settings" element={<ProtectedLayout><Settings /></ProtectedLayout>} />
          <Route path="/settings/profile" element={<ProtectedLayout><Settings /></ProtectedLayout>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}
