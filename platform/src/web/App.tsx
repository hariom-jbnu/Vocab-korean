import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { resolveRoute } from '../core/tenant';
import { api } from './api';
import { useSession } from './session';
import { HomePage } from './pages/Home';
import { DeckPage } from './pages/Deck';
import { PracticePage } from './pages/Practice';
import { CreatorPage } from './pages/Creator';
import { LoginPage } from './pages/Login';
import { StudioPage } from './pages/Studio';
import { NewDeckPage } from './pages/NewDeck';
import { EditDeckPage } from './pages/EditDeck';
import { AdminPage } from './pages/Admin';
import { DocsPage } from './pages/Docs';

export function App() {
  const { tenant, loading } = useSession();
  const { pathname } = useLocation();
  // On a creator subdomain (ravi.localhost), the home page is that creator's page.
  const tenantHome = tenant && pathname === '/';

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-8">
        <Routes>
          <Route path="/" element={loading ? null : tenantHome ? <CreatorPage slug={tenant} /> : <HomePage />} />
          <Route path="/p/:code" element={<DeckPage />} />
          <Route path="/p/:code/:mode" element={<PracticePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/studio" element={<StudioPage />} />
          <Route path="/studio/new" element={<NewDeckPage />} />
          <Route path="/studio/decks/:id" element={<EditDeckPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/docs" element={<DocsPage />} />
          <Route path="*" element={<CatchAll />} />
        </Routes>
      </main>
      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        Local prototype · data stays on this computer · <Link to="/docs" className="underline">Manual</Link>
      </footer>
    </div>
  );
}

/** /@ravi -> creator page, /A7K9 -> practice that deck, else not found. */
function CatchAll() {
  const { pathname } = useLocation();
  const route = resolveRoute(window.location.host, pathname, 'localhost');
  if (route.kind === 'creator') return <CreatorPage slug={route.slug} />;
  if (route.kind === 'deck') return <Navigate to={`/p/${route.code}`} replace />;
  return (
    <div className="card text-center">
      <h1 className="text-xl font-bold">Page not found</h1>
      <p className="mt-2 text-slate-600">
        Looking for a deck? <Link to="/" className="text-brand underline">Enter its 4-character code</Link>.
      </p>
    </div>
  );
}

function Header() {
  const { user, refresh } = useSession();
  const navigate = useNavigate();
  const link = ({ isActive }: { isActive: boolean }) => `rounded-lg px-2.5 py-1.5 text-sm ${isActive ? 'bg-slate-100 font-semibold' : 'text-slate-600 hover:bg-slate-100'}`;
  const member = user?.kind === 'member';

  async function logout() {
    await api.logout();
    await refresh();
    navigate('/');
  }

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-1 px-4 py-2.5">
        <Link to="/" className="mr-2 flex items-center gap-2 font-bold">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#0f766e] text-sm text-white">V</span>
          <span className="hidden sm:inline">Vocab</span>
        </Link>
        <NavLink to="/" end className={link}>
          Practice
        </NavLink>
        <NavLink to="/studio" className={link}>
          Studio
        </NavLink>
        <NavLink to="/docs" className={link}>
          Manual
        </NavLink>
        {user?.role === 'admin' && (
          <NavLink to="/admin" className={link}>
            Reports
          </NavLink>
        )}
        <div className="ml-auto flex items-center gap-2 text-sm">
          {member ? (
            <>
              <span className="hidden text-slate-600 sm:inline">{user.displayName}</span>
              <button className="rounded-lg px-2.5 py-1.5 text-slate-600 hover:bg-slate-100" onClick={logout}>
                Sign out
              </button>
            </>
          ) : (
            <Link to="/login" className="rounded-lg bg-slate-900 px-3 py-1.5 text-white">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
