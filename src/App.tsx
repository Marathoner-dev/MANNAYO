import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Header } from './components/Header';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { CreateCalendar } from './pages/CreateCalendar';
import { JoinCalendar } from './pages/JoinCalendar';
import { CalendarDetail } from './pages/CalendarDetail';
import './App.css';

// Protected Route 컴포넌트
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>로딩 중...</div>;
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route
        path="/calendars"
        element={<Navigate to="/" replace />}
      />
      <Route
        path="/calendar/create"
        element={
          <ProtectedRoute>
            <CreateCalendar />
          </ProtectedRoute>
        }
      />
      <Route
        path="/calendar/join"
        element={
          <ProtectedRoute>
            <JoinCalendar />
          </ProtectedRoute>
        }
      />
      <Route
        path="/calendar/:code"
        element={<CalendarDetail />}
      />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="app">
          <Header />
          <main className="main">
            <AppRoutes />
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
