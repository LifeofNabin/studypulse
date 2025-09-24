import React from 'react';
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
import StudentGoals from './components/StudentGoals'; // ← ADDED: Import StudentGoals component
import './App.css';

// ProtectedRoute ensures only authenticated users can access routes
const ProtectedRoute = ({ children, role }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading-spinner">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (role && user.role !== role) {
    return <Navigate to={user.role === 'teacher' ? '/teacher' : '/student'} />;
  }

  return children;
};

const AppRoutes = () => {
  const { user } = useAuth();

  return (
    <Routes>
      {/* Public Routes */}
      <Route
        path="/login"
        element={
          !user ? <Login /> : <Navigate to={user.role === 'teacher' ? '/teacher' : '/student'} />
        }
      />
      <Route
        path="/register"
        element={
          !user ? <Register /> : <Navigate to={user.role === 'teacher' ? '/teacher' : '/student'} />
        }
      />

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
      {/* ← ADDED: Student Goals route */}
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

      {/* Default route */}
      <Route
        path="/"
        element={
          user ? (
            <Navigate to={user.role === 'teacher' ? '/teacher' : '/student'} />
          ) : (
            <Navigate to="/login" />
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