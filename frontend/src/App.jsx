import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import useAuthStore from './context/authStore';
import { initSocket, disconnectSocket } from './services/socket';
import useSocketEvents from './hooks/useSocketEvents';

// Pages
import LoginPage from './pages/LoginPage';
import MainLayout from './components/layout/MainLayout';
import ChatsPage from './pages/ChatsPage';
import StatusPage from './pages/StatusPage';
import CallsPage from './pages/CallsPage';
import ContactsPage from './pages/ContactsPage';
import SettingsPage from './pages/SettingsPage';
import AdminPage from './pages/AdminPage';

const ProtectedRoute = ({ children }) => {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

const AppRoutes = () => {
  useSocketEvents(); // Listen to all socket events
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/chats" replace />} />
      <Route path="/chats" element={<MainLayout><ChatsPage /></MainLayout>} />
      <Route path="/chats/:chatId" element={<MainLayout><ChatsPage /></MainLayout>} />
      <Route path="/status" element={<MainLayout><StatusPage /></MainLayout>} />
      <Route path="/calls" element={<MainLayout><CallsPage /></MainLayout>} />
      <Route path="/contacts" element={<MainLayout><ContactsPage /></MainLayout>} />
      <Route path="/settings" element={<MainLayout><SettingsPage /></MainLayout>} />
      <Route path="/admin" element={<MainLayout><AdminPage /></MainLayout>} />
      <Route path="/join/:linkCode" element={<MainLayout><ChatsPage /></MainLayout>} />
      <Route path="*" element={<Navigate to="/chats" replace />} />
    </Routes>
  );
};

export default function App() {
  const { isAuthenticated, token } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated && token) {
      initSocket(token);
    } else {
      disconnectSocket();
    }
    return () => {};
  }, [isAuthenticated, token]);

  return (
    <BrowserRouter>
      <Toaster
        position="top-center"
        toastOptions={{
          style: { background: '#233138', color: '#e9edef', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px' },
          success: { iconTheme: { primary: '#00a884', secondary: '#233138' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#233138' } },
        }}
      />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<Navigate to="/login" replace />} />
        <Route path="/*" element={
          <ProtectedRoute>
            <AppRoutes />
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}
