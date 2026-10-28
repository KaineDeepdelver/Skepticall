import React, { Suspense, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { GuestPromptProvider, useGuestPrompt } from './context/GuestPromptContext';
import { FriendProvider } from './context/FriendContext';
import { ThemeProvider } from './context/ThemeContext';
import { SidebarProvider } from './context/SidebarContext';
import { WebSocketProvider } from './context/WebSocketContext';
import { CallProvider } from './context/CallContext';
import { GroupCallProvider } from './context/GroupCallContext';
import { E2EEProvider } from './e2e/E2EEContext';
import { VaultProvider } from './e2e/VaultContext';
import { BlockProvider } from './context/BlockContext';
import { EncryptionGate } from './e2e/EncryptionGate';
import GroupCallOverlay from './components/GroupCallOverlay';
import AppLayout      from './components/layout/AppLayout';
import GuestPromptModal from './components/GuestPromptModal';
import SignIn          from './pages/auth/SignIn';
import SignUp          from './pages/auth/SignUp';
const ForgotPasswordEmail = lazyWithRetry(() => import('./pages/auth/ForgotPasswordEmail'));
const ForgotPasswordVerify = lazyWithRetry(() => import('./pages/auth/ForgotPasswordVerify'));
const ForgotPasswordReset = lazyWithRetry(() => import('./pages/auth/ForgotPasswordReset'));
import Messages       from './pages/Messages';
const Calls = lazyWithRetry(() => import('./pages/Calls'));
const AdminReportsPage = lazyWithRetry(() => import('./pages/AdminReportsPage'));
const Settings = lazyWithRetry(() => import('./pages/Settings'));
const ProfilePage = lazyWithRetry(() => import('./pages/ProfilePage'));
const SearchPage = lazyWithRetry(() => import('./pages/SearchPage'));
import HomeEntry        from './pages/HomeEntry';
const TermsPage = lazyWithRetry(() => import('./pages/TermsPage'));
const PrivacyPolicyPage = lazyWithRetry(() => import('./pages/PrivacyPolicyPage'));
const CookiePolicyPage = lazyWithRetry(() => import('./pages/CookiePolicyPage'));
const RefundPolicyPage = lazyWithRetry(() => import('./pages/RefundPolicyPage'));
const DataDeletionPage = lazyWithRetry(() => import('./pages/DataDeletionPage'));
const EmailPreferencesPage = lazyWithRetry(() => import('./pages/EmailPreferencesPage'));
import { ConsentProvider } from './consent/ConsentContext';
import lazyWithRetry from './utils/lazyWithRetry';
import SplashScreen from './components/SplashScreen';
import TopProgress from './components/TopProgress';
import CookieBanner from './consent/CookieBanner';

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

export default function App() {
  return (
    <ThemeProvider>
      <SidebarProvider>
      <ConsentProvider>
      <AuthProvider>
        <E2EEProvider>
        <VaultProvider>
        <BlockProvider>
        <GuestPromptProvider>
        <FriendProvider>
        <WebSocketProvider>
        <CallProvider>
        <GroupCallProvider>
        <BrowserRouter>
          <EncryptionGate />
          <CookieBanner />
          <TopProgress />
          <Suspense fallback={<SplashScreen />}>
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
            <Route path="/cookie-policy"  element={<CookiePolicyPage />} />
            <Route path="/refund-policy"  element={<RefundPolicyPage />} />
            <Route path="/data-deletion"  element={<DataDeletionPage />} />
            <Route path="/data-deletion/confirm" element={<DataDeletionPage confirm />} />
            <Route path="/email-preferences" element={<EmailPreferencesPage />} />
            {/* Standalone watch page — deliberately OUTSIDE AppLayout so it
                gets its own dedicated WatchTopBar instead of the global one */}
            {/* "/" — messages when logged in, the introduction page otherwise.
                Must stay ABOVE the AppLayout route so the page renders without the app shell. */}
            <Route path="/" element={<HomeEntry />} />
            <Route path="/" element={<ViewRoute><AppLayout /></ViewRoute>}>
              <Route path="messages"          element={<AccountRoute><Messages /></AccountRoute>} />
              <Route path="calls"             element={<AccountRoute><Calls /></AccountRoute>} />
              <Route path="admin/reports"     element={<AccountRoute><AdminReportsPage /></AccountRoute>} />
              <Route path="settings"          element={<Settings />} />
              <Route path="profile/:username"  element={<ProfilePage />} />
              <Route path="search"            element={<SearchPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
          <GuestPromptModal />
          <GroupCallOverlay />
        </BrowserRouter>
        </GroupCallProvider>
        </CallProvider>
        </WebSocketProvider>
        </FriendProvider>
        </GuestPromptProvider>
        </BlockProvider>
        </VaultProvider>
        </E2EEProvider>
      </AuthProvider>
      </ConsentProvider>
      </SidebarProvider>
    </ThemeProvider>
  );
}
