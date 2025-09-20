import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import Register from './components/Register';
import TeacherDashboard from './components/TeacherDashboard';
import StudentDashboard from './components/StudentDashboard';
import StudySession from './components/StudySession';
import TeacherMonitoring from './components/TeacherMonitoring';
import './App.css';

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
      <Route path="/login" element={!user ? <Login /> : <Navigate to={user.role === 'teacher' ? '/teacher' : '/student'} />} />
      <Route path="/register" element={!user ? <Register /> : <Navigate to={user.role === 'teacher' ? '/teacher' : '/student'} />} />
      
      <Route path="/teacher" element={
        <ProtectedRoute role="teacher">
          <TeacherDashboard />
        </ProtectedRoute>
      } />
      
      <Route path="/teacher/room/:roomId/monitor" element={
        <ProtectedRoute role="teacher">
          <TeacherMonitoring />
        </ProtectedRoute>
      } />
      
      <Route path="/student" element={
        <ProtectedRoute role="student">
          <StudentDashboard />
        </ProtectedRoute>
      } />
      
      <Route path="/session/:sessionId" element={
        <ProtectedRoute role="student">
          <StudySession />
        </ProtectedRoute>
      } />
      
      <Route path="/" element={
        user ? <Navigate to={user.role === 'teacher' ? '/teacher' : '/student'} /> : <Navigate to="/login" />
      } />
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