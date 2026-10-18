import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import SkepticallLogo from '../components/SkepticallLogo';
import { CookieSettingsButton } from '../legal/LegalLayout';
import { business, operatorName } from '../config/business';
import '../styles/landing.css';

/* ============================================================================
 * Introduction page for visitors who aren't logged in.
 *
 * All the wording lives in the constants below, so it is easy to adjust.
 * Only describe things the app really does: this page is a promise to visitors.
 * ========================================================================== */

const HERO = {
  eyebrow: 'Private chat, voice & video',
  titleTop: 'Talk freely.',
  titleAccent: 'We just deliver it.',
  sub:
    'Skepticall is a place for chat, voice calls and video calls with the people you care about. ' +
    'Messages and files are end-to-end encrypted, so we can’t read them. Our servers only hold them while they’re ' +
    'being delivered, and never keep them longer than 30 days.',
  trust: 'We can’t read your messages, and we don’t sell your data.',
};

const RIBBON = ['chat', 'voice calls', 'video calls', 'group chats', 'photos & files', 'voice notes', 'replies'];

const SECTIONS = [
  {
    id: 'privacy',
    visual: 'delivery',
    eyebrow: 'Privacy',
    title: 'Built so we can’t hold on to your chats',
    body:
      'Messages and files are encrypted on your device before they are sent, and only the people in the conversation can open them. ' +
      'If your friend is offline, the server holds the encrypted message only until it is delivered, then deletes it. ' +
      'Nothing is ever kept longer than 30 days.',
    points: [
      'Encrypted messages and files',
      'Deleted from our servers once delivered',
      'Never kept longer than 30 days',
    ],
  },
  {
    id: 'calls',
    visual: 'calls',
    flip: true,
    eyebrow: 'Calls',
    title: 'Hop on a call, solo or with the whole group',
    body:
      'Start a voice or video call with one tap, one-to-one or with a group chat. ' +
      'No links to send and nothing to install: it works right in your browser.',
    points: ['Voice and video calls', 'One-to-one and group calls', 'Start one right from your chat'],
  },
  {
    id: 'share',
    visual: 'share',
    eyebrow: 'Sharing',
    title: 'Share it all, then take it back',
    body:
      'Send photos, videos, files and voice notes. Reply to a specific message, fix a typo, ' +
      'or delete what you sent when you change your mind.',
    points: ['Photos, videos and files', 'Voice notes with a waveform', 'Reply, edit and delete'],
  },
];

const MORE = [
  { icon: 'users', title: 'Group chats', text: 'Bring your friends together in one place, with group calls built in.' },
  { icon: 'reply', title: 'Replies & edits', text: 'Answer a specific message, correct a typo, or remove something.' },
  { icon: 'mic', title: 'Voice notes', text: 'Say it out loud instead of typing it, with a waveform to see it.' },
  { icon: 'image', title: 'Photos, video & files', text: 'Share what you’re looking at, right in the conversation.' },
  { icon: 'eyeOff', title: 'Appear offline', text: 'Stay on without everyone seeing you’re around.' },
  { icon: 'sun', title: 'Light, dark & your colors', text: 'Pick a theme and an accent color that feels like yours.' },
];

const FOOTER_COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'Privacy', href: '#privacy' },
      { label: 'Calls', href: '#calls' },
      { label: 'Sharing', href: '#share' },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'Log in', to: '/accounts/login' },
      { label: 'Create account', to: '/accounts/register' },
      { label: 'Forgot password', to: '/forgot-password' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Terms of Service', to: '/terms' },
      { label: 'Privacy Policy', to: '/privacy-policy' },
      { label: 'Cookie Policy', to: '/cookie-policy' },
      { label: 'Refund Policy', to: '/refund-policy' },
      { label: 'Delete my data', to: '/data-deletion' },
      { label: 'Cookie settings', cookies: true },
    ],
  },
];

/* ---------------------------------- icons ---------------------------------- */

const ICONS = {
  lock: (<><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>),
  users: (<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>),
  phone: (<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />),
  video: (<><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></>),
  image: (<><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></>),
  mic: (<><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></>),
  reply: (<><polyline points="9 14 4 9 9 4" /><path d="M20 20v-7a4 4 0 0 0-4-4H4" /></>),
  eyeOff: (<><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></>),
  sun: (<><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></>),
  file: (<><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><polyline points="13 2 13 9 20 9" /></>),
  server: (<><rect x="2" y="2" width="20" height="8" rx="2" ry="2" /><rect x="2" y="14" width="20" height="8" rx="2" ry="2" /><line x1="6" y1="6" x2="6.01" y2="6" /><line x1="6" y1="18" x2="6.01" y2="18" /></>),
  arrow: (<><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></>),
};

function Icon({ name, size = 20 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICONS[name]}
    </svg>
  );
}

/* ---------------------------- decorative visuals ---------------------------- */
/* Pure HTML/CSS illustrations (hidden from screen readers). Names are made up. */

function HeroMock() {
  return (
    <div className="lp-mock" aria-hidden="true">
      <div className="lp-mock-side">
        <span className="lp-av lp-av--a is-on">M</span>
        <span className="lp-av lp-av--b">J</span>
        <span className="lp-av lp-av--c">A</span>
      </div>
      <div className="lp-mock-chat">
        <div className="lp-mock-head">
          <span className="lp-av lp-av--a lp-av--sm">M</span>
          <div>
            <strong>Maya</strong>
            <small>online</small>
          </div>
          <span className="lp-mock-head-icons"><Icon name="phone" size={16} /><Icon name="video" size={16} /></span>
        </div>
        <div className="lp-bubble lp-bubble--in">Are we still on for tonight?</div>
        <div className="lp-bubble lp-bubble--out">Yes! Calling you in 5.</div>
        <div className="lp-callcard">
          <span className="lp-callcard-ic"><Icon name="phone" size={16} /></span>
          <div><strong>Voice call</strong><small>12:08</small></div>
        </div>
        <div className="lp-mock-foot"><Icon name="lock" size={13} /> Encrypted · delivered</div>
      </div>
    </div>
  );
}

function DeliveryVisual() {
  return (
    <div className="lp-card lp-flow" aria-hidden="true">
      <div className="lp-flow-row">
        <div className="lp-node"><span className="lp-node-ic"><Icon name="phone" size={22} /></span><b>You</b><small>encrypts it</small></div>
        <span className="lp-flow-arrow"><Icon name="arrow" /></span>
        <div className="lp-node lp-node--mid"><span className="lp-node-ic"><Icon name="server" size={22} /></span><b>Skepticall</b><small>delivers it</small></div>
        <span className="lp-flow-arrow"><Icon name="arrow" /></span>
        <div className="lp-node"><span className="lp-node-ic"><Icon name="users" size={22} /></span><b>Your friend</b><small>keeps it</small></div>
      </div>
      <div className="lp-flow-note"><Icon name="lock" size={14} /> Server copy deleted a few minutes after delivery</div>
    </div>
  );
}

function CallsVisual() {
  const tiles = [
    { cls: 'lp-av--a', letter: 'M', name: 'Maya', speaking: true },
    { cls: 'lp-av--b', letter: 'J', name: 'Jonas' },
    { cls: 'lp-av--c', letter: 'A', name: 'Ayla' },
    { cls: 'lp-av--d', letter: 'Y', name: 'You' },
  ];
  return (
    <div className="lp-card lp-calls" aria-hidden="true">
      <div className="lp-tiles">
        {tiles.map((t) => (
          <div key={t.name} className={`lp-tile${t.speaking ? ' is-speaking' : ''}`}>
            <span className={`lp-av lp-av--lg ${t.cls}`}>{t.letter}</span>
            <small>{t.name}</small>
          </div>
        ))}
      </div>
      <div className="lp-callbar">
        <span className="lp-cbtn"><Icon name="mic" size={18} /></span>
        <span className="lp-cbtn"><Icon name="video" size={18} /></span>
        <span className="lp-cbtn lp-cbtn--end"><Icon name="phone" size={18} /></span>
      </div>
    </div>
  );
}

const WAVE = [6, 12, 20, 9, 24, 14, 28, 10, 18, 26, 8, 22, 15, 30, 11, 19, 7, 23, 13, 17];

function ShareVisual() {
  return (
    <div className="lp-card lp-share" aria-hidden="true">
      <div className="lp-bubble lp-bubble--in lp-bubble--media">
        <div className="lp-photo"><Icon name="image" size={30} /></div>
        <span>Look at this view</span>
      </div>
      <div className="lp-bubble lp-bubble--out lp-bubble--quote">
        <em>Look at this view</em>
        <span>Wow. Where is that?</span>
      </div>
      <div className="lp-bubble lp-bubble--in lp-voice">
        <span className="lp-voice-play"><Icon name="mic" size={14} /></span>
        <span className="lp-wave">
          {WAVE.map((h, i) => <i key={i} style={{ height: h }} />)}
        </span>
        <small>0:14</small>
      </div>
      <div className="lp-filechip">
        <Icon name="file" size={18} />
        <div><b>trip-plan.pdf</b><small>2.1 MB</small></div>
      </div>
    </div>
  );
}

const VISUALS = { delivery: DeliveryVisual, calls: CallsVisual, share: ShareVisual };

/* ------------------------------- the page ---------------------------------- */

function useReveal(rootRef) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const items = root.querySelectorAll('[data-reveal]');
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (typeof IntersectionObserver === 'undefined' || reduce) {
      items.forEach((el) => el.classList.add('lp-in'));
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('lp-in');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [rootRef]);
}

export default function LandingPage() {
  const rootRef = useRef(null);
  const [solid, setSolid] = useState(false);
  useReveal(rootRef);

  // Smooth in-page links, and a solid nav bar once the page is scrolled.
  useEffect(() => {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const html = document.documentElement;
    const previous = html.style.scrollBehavior;
    if (!reduce) html.style.scrollBehavior = 'smooth';
    const onScroll = () => setSolid(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      html.style.scrollBehavior = previous;
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <div className="lp" ref={rootRef}>
      <a className="lp-skip" href="#main">Skip to content</a>

      <header className={`lp-nav${solid ? ' lp-nav--solid' : ''}`}>
        <div className="lp-wrap lp-nav-inner">
          <Link to="/" className="lp-brand" aria-label="Skepticall home">
            <SkepticallLogo size={22} />
          </Link>
          <nav className="lp-links" aria-label="Page sections">
            <a href="#privacy">Privacy</a>
            <a href="#calls">Calls</a>
            <a href="#share">Sharing</a>
          </nav>
          <div className="lp-nav-cta">
            <Link to="/accounts/login" className="lp-btn lp-btn--ghost">Log in</Link>
            <Link to="/accounts/register" className="lp-btn lp-btn--primary lp-hide-xs">Sign up</Link>
          </div>
        </div>
      </header>

      <main id="main">
        {/* Hero */}
        <section className="lp-hero">
          <div className="lp-wrap lp-hero-grid">
            <div className="lp-hero-copy">
              <span className="lp-eyebrow"><Icon name="lock" size={14} /> {HERO.eyebrow}</span>
              <h1 className="lp-h1">
                {HERO.titleTop} <span className="lp-grad">{HERO.titleAccent}</span>
              </h1>
              <p className="lp-sub">{HERO.sub}</p>
              <div className="lp-cta-row">
                <Link to="/accounts/register" className="lp-btn lp-btn--primary lp-btn--lg">Create your account</Link>
                <Link to="/accounts/login" className="lp-btn lp-btn--ghost lp-btn--lg">Log in</Link>
              </div>
              <p className="lp-trust"><Icon name="lock" size={14} /> {HERO.trust}</p>
            </div>
            <HeroMock />
          </div>
        </section>

        {/* Scrolling ribbon */}
        <div className="lp-ribbon" aria-hidden="true">
          <div className="lp-ribbon-track">
            {[...RIBBON, ...RIBBON, ...RIBBON, ...RIBBON].map((word, i) => (
              <span key={i}>{word}<i /></span>
            ))}
          </div>
        </div>

        {/* Feature sections */}
        {SECTIONS.map((s) => {
          const Visual = VISUALS[s.visual];
          return (
            <section key={s.id} id={s.id} className={`lp-section${s.flip ? ' lp-section--flip' : ''}`}>
              <div className="lp-wrap lp-section-grid">
                <div className="lp-text" data-reveal>
                  <span className="lp-kicker">{s.eyebrow}</span>
                  <h2 className="lp-h2">{s.title}</h2>
                  <p className="lp-body">{s.body}</p>
                  <ul className="lp-points">
                    {s.points.map((p) => <li key={p}>{p}</li>)}
                  </ul>
                </div>
                <div className="lp-visual" data-reveal>
                  <Visual />
                </div>
              </div>
            </section>
          );
        })}

        {/* Everything else */}
        <section className="lp-more">
          <div className="lp-wrap">
            <h2 className="lp-h2 lp-center" data-reveal>Everything you need to keep in touch</h2>
            <div className="lp-more-grid">
              {MORE.map((m) => (
                <div key={m.title} className="lp-more-card" data-reveal>
                  <span className="lp-more-ic"><Icon name={m.icon} size={22} /></span>
                  <h3>{m.title}</h3>
                  <p>{m.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final call to action */}
        <section className="lp-final">
          <div className="lp-wrap lp-final-inner" data-reveal>
            <h2 className="lp-final-title">Your next conversation starts here.</h2>
            <p className="lp-final-sub">Create an account and invite your friends.</p>
            <div className="lp-cta-row lp-cta-row--center">
              <Link to="/accounts/register" className="lp-btn lp-btn--primary lp-btn--lg">Create your account</Link>
              <Link to="/accounts/login" className="lp-btn lp-btn--ghost lp-btn--lg">Log in</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-wrap lp-footer-grid">
          <div className="lp-footer-brand">
            <SkepticallLogo size={20} />
            <p>Private chat, voice and video.</p>
          </div>
          {FOOTER_COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h3>{col.title}</h3>
              <ul>
                {col.links.map((l) => (
                  <li key={l.label}>
                    {l.cookies
                      ? <CookieSettingsButton className="lp-linkbtn" />
                      : l.to ? <Link to={l.to}>{l.label}</Link> : <a href={l.href}>{l.label}</a>}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="lp-wrap lp-footer-bottom">
          <small>
            © {new Date().getFullYear()} {operatorName}
            {business.address && <> · {business.address}</>}
            {business.email && <> · <a href={`mailto:${business.email}`}>{business.email}</a></>}
          </small>
        </div>
      </footer>
    </div>
  );
}
