import React, { useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { GuestPromptProvider, useGuestPrompt } from './context/GuestPromptContext';
import { FriendProvider } from './context/FriendContext';
import { ThemeProvider } from './context/ThemeContext';
import { SidebarProvider } from './context/SidebarContext';
import { WebSocketProvider } from './context/WebSocketContext';
import { CallProvider } from './context/CallContext';
import { GroupCallProvider } from './context/GroupCallContext';
import GroupCallOverlay from './components/GroupCallOverlay';
import AppLayout      from './components/layout/AppLayout';
import GuestPromptModal from './components/GuestPromptModal';
import SignIn          from './pages/auth/SignIn';
import SignUp          from './pages/auth/SignUp';
import ForgotPasswordEmail    from './pages/auth/ForgotPasswordEmail';
import ForgotPasswordVerify   from './pages/auth/ForgotPasswordVerify';
import ForgotPasswordReset    from './pages/auth/ForgotPasswordReset';
import Messages       from './pages/Messages';
import Calls          from './pages/Calls';
import Settings       from './pages/Settings';
import ProfilePage    from './pages/ProfilePage';
import SearchPage     from './pages/SearchPage';
import TermsPage         from './pages/TermsPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';

// Settings, profiles and search are viewable without extra gating.
function ViewRoute({ children }) {
  return children;
}

// Requires a real account — guests are sent to the login page.
function AccountRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/accounts/login" replace />;
  return children;
}

// "/" is just an entry point: messages when logged in, login otherwise.
function HomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={user ? '/messages' : '/accounts/login'} replace />;
}

export default function App() {
  return (
    <ThemeProvider>
      <SidebarProvider>
      <AuthProvider>
        <GuestPromptProvider>
        <FriendProvider>
        <WebSocketProvider>
        <CallProvider>
        <GroupCallProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/accounts/login"    element={<SignIn />} />
            <Route path="/accounts/register" element={<SignUp />} />
            <Route path="/forgot-password"          element={<ForgotPasswordEmail />} />
            <Route path="/forgot-password/verify"   element={<ForgotPasswordVerify />} />
            <Route path="/forgot-password/reset"    element={<ForgotPasswordReset />} />
            {/* Legacy auth URLs — redirect old bookmarks/links to the new paths */}
            <Route path="/signin"          element={<Navigate to="/accounts/login" replace />} />
            <Route path="/signin/password" element={<Navigate to="/accounts/login" replace />} />
            <Route path="/signup"          element={<Navigate to="/accounts/register" replace />} />
            <Route path="/signup/password" element={<Navigate to="/accounts/register" replace />} />
            <Route path="/signup/username" element={<Navigate to="/accounts/register" replace />} />
            <Route path="/signup/verify"   element={<Navigate to="/accounts/register" replace />} />
            {/* Legal pages — accessible without login */}
            <Route path="/terms"          element={<TermsPage />} />
            <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
            {/* Standalone watch page — deliberately OUTSIDE AppLayout so it
                gets its own dedicated WatchTopBar instead of the global one */}
            <Route path="/" element={<ViewRoute><AppLayout /></ViewRoute>}>
              <Route index                    element={<HomeRedirect />} />
              <Route path="messages"          element={<AccountRoute><Messages /></AccountRoute>} />
              <Route path="calls"             element={<AccountRoute><Calls /></AccountRoute>} />
              <Route path="settings"          element={<Settings />} />
              <Route path="profile/:username"  element={<ProfilePage />} />
              <Route path="search"            element={<SearchPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <GuestPromptModal />
          <GroupCallOverlay />
        </BrowserRouter>
        </GroupCallProvider>
        </CallProvider>
        </WebSocketProvider>
        </FriendProvider>
        </GuestPromptProvider>
      </AuthProvider>
      </SidebarProvider>
    </ThemeProvider>
  );
}
