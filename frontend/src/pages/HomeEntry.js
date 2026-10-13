import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LandingPage from './LandingPage';

/**
 * "/" entry point: people who are logged in go straight to their messages,
 * everyone else sees the introduction page. (AuthProvider holds the first
 * render until the remember-me check finishes, so a remembered user never
 * sees this page flash by.)
 */
export default function HomeEntry() {
  const { user } = useAuth();
  return user ? <Navigate to="/messages" replace /> : <LandingPage />;
}
