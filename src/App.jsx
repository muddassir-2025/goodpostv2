import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import authService from "./appwrite/auth";
import AppErrorBoundary from "./components/AppErrorBoundary";
import AppShell from "./components/AppShell";
import ProtectedRoute from "./components/ProtectedRoute";
import { login, logout } from "./features/auth/authSlice";
import CreatePost from "./pages/CreatePost";
import EditPost from "./pages/EditPost";
import Favorites from "./pages/Favorite";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Messages from "./pages/Messages";
import Profile from "./pages/Profile";
import Feed from "./pages/Reels";
import Search from "./pages/Search";
import Signup from "./pages/Signup";
import SinglePost from "./pages/SinglePost";
import TagFeed from "./pages/TagFeed";
import ConfirmPopup from "./components/ConfirmPopup";

import Notifications from "./pages/Notifications";

function App() {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authService.getCurrentUser().then((user) => {
      if (user) {
        dispatch(login(user));
      } else {
        dispatch(logout());
      }

      setLoading(false);
    });
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
    </BrowserRouter>
  );
}

export default App;
