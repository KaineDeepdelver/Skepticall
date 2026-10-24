import React from 'react';
import ReactDOM from 'react-dom/client';
// Inter is served from our own origin (OFL-1.1); no request goes to Google Fonts.
import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import './styles/global.css';
import './styles/animations.css';
import './styles/settings-additions.css';
import App from './App';
import { installKeyboardSupport } from './a11y/keyboard';
// Keep last: page-level CSS (landing, legal, consent) loads with App, and this unifies the controls across all of it.
import './styles/components.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);