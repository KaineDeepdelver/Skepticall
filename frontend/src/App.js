import React, { useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { GuestPromptProvider, useGuestPrompt } from './context/GuestPromptContext';
import { FriendProvider } from './context/FriendContext';
import { ThemeProvider } from './context/ThemeContext';
import { SidebarProvider } from './context/SidebarContext';
import { WebSocketProvider } from './context/WebSocketContext';
import { CallProvider } from './context/CallContext';
import AppLayout      from './components/layout/AppLayout';
import GuestPromptModal from './components/GuestPromptModal';
import SignIn          from './pages/auth/SignIn';
import SignUp          from './pages/auth/SignUp';
import ForgotPasswordEmail    from './pages/auth/ForgotPasswordEmail';
import ForgotPasswordVerify   from './pages/auth/ForgotPasswordVerify';
import ForgotPasswordReset    from './pages/auth/ForgotPasswordReset';
import Home           from './pages/Home';
import Messages       from './pages/Messages';
import Media          from './pages/Media';
import Watch          from './pages/Watch';
import Settings       from './pages/Settings';
import ProfilePage    from './pages/ProfilePage';
import NetworksPage   from './pages/NetworksPage';
import PostDetailPage from './pages/PostDetailPage';
import Create         from './pages/Create';
import CreateMedia    from './pages/CreateMedia';
import SearchPage     from './pages/SearchPage';
import TermsPage         from './pages/TermsPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';

// Public viewing content — feed, media, profiles, search, watch,
// settings-appearance. No login required; anyone (logged in or not)
// can look. Guest mode isn't something you have to opt into first —
// browsing without an account IS guest mode.
function ViewRoute({ children }) {
  return children;
}

// Requires a real account. Instead of instantly bouncing to the login
// page, this pops up a "you need an account" prompt and sends the person
// back to the feed — they choose whether to go log in or keep browsing.
function AccountRoute({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  const { showGuestPrompt } = useGuestPrompt();
  const shown = useRef(false);

  useEffect(() => {
    if (!user && !shown.current) {
      shown.current = true;
      showGuestPrompt('do that', location.pathname);
    }
  }, [user, location.pathname, showGuestPrompt]);

  if (!user) return <Navigate to="/" replace />;
  return children;
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
            <Route path="/posts"           element={<Navigate to="/" replace />} />
            {/* Standalone watch page — deliberately OUTSIDE AppLayout so it
                gets its own dedicated WatchTopBar instead of the global one */}
            <Route path="/media/watch/:id" element={<ViewRoute><Watch /></ViewRoute>} />
            <Route path="/" element={<ViewRoute><AppLayout /></ViewRoute>}>
              <Route index                    element={<Home />} />
              <Route path="messages"          element={<AccountRoute><Messages /></AccountRoute>} />
              <Route path="networks"          element={<AccountRoute><NetworksPage /></AccountRoute>} />
              <Route path="networks/:networkId" element={<AccountRoute><NetworksPage /></AccountRoute>} />
              <Route path="media"             element={<Media />} />
              <Route path="settings"          element={<Settings />} />
              <Route path="profile/:username"  element={<ProfilePage />} />
              <Route path="post/:slug"         element={<PostDetailPage />} />
              <Route path="create"            element={<AccountRoute><Create /></AccountRoute>} />
              <Route path="create/media"      element={<AccountRoute><CreateMedia /></AccountRoute>} />
              <Route path="search"            element={<SearchPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <GuestPromptModal />
        </BrowserRouter>
        </CallProvider>
        </WebSocketProvider>
        </FriendProvider>
        </GuestPromptProvider>
      </AuthProvider>
      </SidebarProvider>
    </ThemeProvider>
  );
}
