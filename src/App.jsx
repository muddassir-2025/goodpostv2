import { useEffect, useState, lazy, Suspense } from "react";
import { useDispatch } from "react-redux";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import authService from "./appwrite/auth";
import AppErrorBoundary from "./components/AppErrorBoundary";
import AppShell from "./components/AppShell";
import ProtectedRoute from "./components/ProtectedRoute";
import { login, logout } from "./features/auth/authSlice";
import ConfirmPopup from "./components/ConfirmPopup";
import Toast from "./components/Toast";

// Lazy load pages
const Home = lazy(() => import("./pages/Home"));
const Search = lazy(() => import("./pages/Search"));
const Messages = lazy(() => import("./pages/Messages"));
const Profile = lazy(() => import("./pages/Profile"));
const Feed = lazy(() => import("./pages/Reels"));
const Favorites = lazy(() => import("./pages/Favorite"));
const Signup = lazy(() => import("./pages/Signup"));
const Login = lazy(() => import("./pages/Login"));
const SinglePost = lazy(() => import("./pages/SinglePost"));
const CreatePost = lazy(() => import("./pages/CreatePost"));
const EditPost = lazy(() => import("./pages/EditPost"));
const TagFeed = lazy(() => import("./pages/TagFeed"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Chat = lazy(() => import("./pages/Chat"));

const PageLoader = () => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-500 border-t-white"></div>
  </div>
);

function App() {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function initAuth() {
      // ✅ Intercept OAuth Tokens to bypass 3rd-party cookie blocking
      const urlParams = new URLSearchParams(window.location.search);
      const userId = urlParams.get("userId");
      const secret = urlParams.get("secret");

      try {
        if (userId && secret) {
          await authService.completeOAuth(userId, secret);
          // Clean up the URL
          window.history.replaceState({}, document.title, window.location.pathname);
        }

        const user = await authService.getCurrentUser();
        if (user) {
          const isAdmin = await authService.checkIsAdmin();
          dispatch(login({ userData: user, isAdmin }));
        } else {
          dispatch(logout());
        }
      } catch (err) {
        console.error("Auth init error:", err);
        dispatch(logout());
      } finally {
        setLoading(false);
      }
    }

    initAuth();
  }, [dispatch]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="rounded-[28px] border border-white/10 bg-[#121212]/90 px-6 py-5 text-center shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Moments</p>
          <h1 className="font-display mt-3 text-2xl text-white">Loading your feed</h1>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>

      {/* ✅ GLOBAL POPUP (must be here) */}
    <ConfirmPopup />
    <Toast />

      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          <Route
            element={(
              <AppErrorBoundary>
                <AppShell />
              </AppErrorBoundary>
            )}
          >
            <Route index element={<Home />} />
            <Route path="/search" element={<Search />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/messages/:conversationId" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
            <Route path="/post/:slug" element={<SinglePost />} />
            <Route 
              path="/notifications" 
              element={
                <ProtectedRoute>
                  <Notifications />
                </ProtectedRoute>
              } 
            />

            <Route
              path="/feed"
              element={
                <ProtectedRoute>
                  <Feed />
                </ProtectedRoute>
              }
            />

            <Route
              path="/reels"
              element={
                <ProtectedRoute>
                  <Feed />
                </ProtectedRoute>
              }
            />

            <Route
              path="/favorites"
              element={
                <ProtectedRoute>
                  <Favorites />
                </ProtectedRoute>
              }
            />
            
            {/* Alias for favorite */}
            <Route
              path="/favorite"
              element={
                <ProtectedRoute>
                  <Favorites />
                </ProtectedRoute>
              }
            />

            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />

            <Route path="/tag/:tag" element={<TagFeed />} />

            <Route
              path="/profile/:id"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />

            <Route
              path="/create"
              element={
                <ProtectedRoute>
                  <CreatePost />
                </ProtectedRoute>
              }
            />

            <Route
              path="/edit/:id"
              element={
                <ProtectedRoute>
                  <EditPost />
                </ProtectedRoute>
              }
            />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
