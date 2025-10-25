import React, { memo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import Register from './components/Register';
import TeacherDashboard from './components/TeacherDashboard';
import StudentDashboard from './components/StudentDashboard';
import StudyRoutine from './components/StudyRoutine';
import StudySession from './components/StudySession';
import TeacherMonitoring from './components/TeacherMonitoring';
import StudentProgress from './components/StudentProgress';
import TeacherStudentProgress from './components/TeacherStudentProgress';
import StudentGoals from './components/StudentGoals';
import AuthCallback from './components/AuthCallback';
import ActiveStudySession from './components/ActiveStudySession';

import './App.css';

// ProtectedRoute ensures only authenticated users can access routes
const ProtectedRoute = memo(({ children, role }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '1.2rem',
        color: '#3b82f6'
      }}>
        Loading...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (role && user.role !== role) {
    return <Navigate to={user.role === 'teacher' ? '/teacher' : '/student'} replace />;
  }

  return children;
});

const AppRoutes = () => {
  const { user, loading } = useAuth();

  // Don't render routes until we know authentication status
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '1.2rem',
        color: '#3b82f6'
      }}>
        Loading...
      </div>
    );
  }

  return (
    <Routes>
      {/* Public Routes */}
      <Route
        path="/login"
        element={
          user ? (
            <Navigate to={user.role === 'teacher' ? '/teacher' : '/student'} replace />
          ) : (
            <Login />
          )
        }
      />
      <Route
        path="/register"
        element={
          user ? (
            <Navigate to={user.role === 'teacher' ? '/teacher' : '/student'} replace />
          ) : (
            <Register />
          )
        }
      />

      {/* Redirect /teacher/login to unified login */}
      <Route path="/teacher/login" element={<Navigate to="/login" replace />} />

      {/* Teacher Routes */}
      <Route
        path="/teacher"
        element={
          <ProtectedRoute role="teacher">
            <TeacherDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/room/:roomId/monitor"
        element={
          <ProtectedRoute role="teacher">
            <TeacherMonitoring />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/student/:studentId/progress"
        element={
          <ProtectedRoute role="teacher">
            <TeacherStudentProgress />
          </ProtectedRoute>
        }
      />

      {/* Student Routes */}
      <Route
        path="/student"
        element={
          <ProtectedRoute role="student">
            <StudentDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/progress"
        element={
          <ProtectedRoute role="student">
            <StudentProgress />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/goals"
        element={
          <ProtectedRoute role="student">
            <StudentGoals />
          </ProtectedRoute>
        }
      />
      <Route
        path="/study-routine"
        element={
          <ProtectedRoute role="student">
            <StudyRoutine />
          </ProtectedRoute>
        }
      />
      <Route
        path="/session/:sessionId"
        element={
          <ProtectedRoute role="student">
            <StudySession />
          </ProtectedRoute>
        }
      />
      <Route path="/student/session" element={<ActiveStudySession />} />

      
      {/* OAuth Callback */}
      <Route path="/auth/callback" element={<AuthCallback />} />

      {/* Default route */}
      <Route
        path="/"
        element={
          user ? (
            <Navigate to={user.role === 'teacher' ? '/teacher' : '/student'} replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
};

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <Router>
          <AppRoutes />
        </Router>
      </AuthProvider>
    </div>
  );
}

export default App;