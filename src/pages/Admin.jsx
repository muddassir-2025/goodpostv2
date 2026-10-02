import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import Avatar from "../components/Avatar";
import EmptyState from "../components/EmptyState";
import adminService from "../services/admin";
import { getHandle } from "../lib/ui";
import { ShieldIcon, SearchIcon } from "../components/ui/Icons";

const TABS = [
  { id: "users", label: "Users" },
  { id: "reported", label: "Reported" },
  { id: "system", label: "System" },
];

function StatCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-[#121212]/80 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-6">
      <h2 className="font-display text-lg text-white">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function Admin() {
  const user = useSelector((state) => state.auth.userData);
  const isAdmin = useSelector((state) => state.auth.isAdmin);

  const [tab, setTab] = useState("users");
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [reported, setReported] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState(null);

  const loadUsers = useCallback(async (term) => {
    const res = await adminService.getUsers({ search: term });
    setUsers(res?.documents || []);
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const [statsRes, usersRes, reportedRes] = await Promise.all([
          adminService.getStats(),
          adminService.getUsers({ search: "" }),
          adminService.getReportedPosts(),
        ]);
        if (!active) return;
        setStats(statsRes);
        setUsers(usersRes?.documents || []);
        setReported(reportedRes?.documents || []);
      } catch (err) {
        if (active) setError(err.message || "Failed to load admin data");
      } finally {
        if (active) setLoading(false);
      }
    }

    if (isAdmin) load();
    else setLoading(false);

    return () => {
      active = false;
    };
  }, [isAdmin]);

  async function handleSearch(event) {
    event.preventDefault();
    try {
      setError("");
      await loadUsers(search.trim());
    } catch (err) {
      setError(err.message || "Search failed");
    }
  }

  async function toggleAdmin(target) {
    const next = !target.isAdmin;
    setPendingId(target.$id);
    setError("");
    try {
      const updated = await adminService.setAdmin(target.$id, next);
      setUsers((prev) => prev.map((u) => (u.$id === updated.$id ? updated : u)));
      const fresh = await adminService.getStats();
      setStats(fresh);
    } catch (err) {
      setError(err.message || "Failed to update user");
    } finally {
      setPendingId(null);
    }
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <EmptyState
          eyebrow="Admins only"
          title="You don't have access"
          description="You need admin access to view this page."
        />
      </div>
    );
  }

  const counts = stats?.counts || {};

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-3 py-6 sm:px-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-zinc-200">
            <ShieldIcon className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-2xl text-white">Admin</h1>
            <p className="text-xs text-zinc-500">Moderation and system health</p>
          </div>
        </div>

        <nav className="flex gap-1 rounded-full border border-white/10 bg-white/5 p-1">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`rounded-full px-4 py-1.5 text-sm transition ${
                tab === item.id ? "bg-zinc-100 font-semibold text-zinc-950" : "text-zinc-300 hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      {error && (
        <p className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Users" value={loading ? "—" : counts.users ?? 0} />
        <StatCard label="Posts" value={loading ? "—" : counts.posts ?? 0} />
        <StatCard label="Comments" value={loading ? "—" : counts.comments ?? 0} />
        <StatCard label="Reported" value={loading ? "—" : counts.reportedPosts ?? 0} />
      </div>

      {tab === "users" && (
        <Panel title="Users">
          <form onSubmit={handleSearch} className="mb-4 flex gap-2">
            <div className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name or email"
                className="w-full rounded-full border border-white/10 bg-white/5 py-2 pl-9 pr-4 text-sm text-white placeholder:text-zinc-500 focus:border-white/25 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200 transition hover:border-white/25 hover:text-white"
            >
              Search
            </button>
          </form>

          {users.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">
              {loading ? "Loading users…" : "No users found."}
            </p>
          ) : (
            <ul className="divide-y divide-white/5">
              {users.map((item) => (
                <li key={item.$id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={item.name} userId={item.$id} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">
                        {getHandle(item.name)}
                        {item.isAdmin && (
                          <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                            admin
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-zinc-500">{item.email || "no email"}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={pendingId === item.$id || item.$id === user?.$id}
                    onClick={() => toggleAdmin(item)}
                    title={item.$id === user?.$id ? "You cannot change your own access" : undefined}
                    className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      item.isAdmin
                        ? "border-rose-500/30 bg-rose-500/10 text-rose-200 hover:border-rose-500/50"
                        : "border-white/10 bg-white/5 text-zinc-200 hover:border-white/25 hover:text-white"
                    } disabled:cursor-not-allowed disabled:opacity-40`}
                  >
                    {pendingId === item.$id ? "…" : item.isAdmin ? "Revoke" : "Make admin"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      {tab === "reported" && (
        <Panel title="Reported posts">
          {reported.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">
              {loading ? "Loading…" : "Nothing has been reported."}
            </p>
          ) : (
            <ul className="divide-y divide-white/5">
              {reported.map((post) => (
                <li key={post.$id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <Link to={`/post/${post.slug}`} className="truncate text-sm font-medium text-white hover:underline">
                      {post.title || "(untitled)"}
                    </Link>
                    <p className="truncate text-xs text-zinc-500">
                      by {getHandle(post.authorName)} · {post.reportCount} report
                      {post.reportCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <Link
                    to={`/post/${post.slug}`}
                    className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-white/25 hover:text-white"
                  >
                    Review
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      {tab === "system" && (
        <Panel title="System">
          {!stats ? (
            <p className="py-8 text-center text-sm text-zinc-500">Loading…</p>
          ) : (
            <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-zinc-500">Uptime</dt>
                <dd className="text-white">{Math.floor((stats.process?.uptimeSeconds || 0) / 60)} min</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Memory</dt>
                <dd className="text-white">{stats.process?.memoryMb ?? "—"} MB</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Requests</dt>
                <dd className="text-white">{stats.process?.requests ?? 0}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Uploads</dt>
                <dd className="text-white">{stats.process?.uploads ?? 0}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Blocked images</dt>
                <dd className="text-white">{stats.process?.moderationBlocked ?? 0}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Errors</dt>
                <dd className="text-white">{stats.process?.errors ?? 0}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Moderation</dt>
                <dd className="text-white">
                  {stats.moderation?.enabled ? (stats.moderation.ready ? "ready" : "loading") : "disabled"}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Fail policy</dt>
                <dd className="text-white">{stats.moderation?.failPolicy ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Error tracking</dt>
                <dd className="text-white">{stats.process?.sentryEnabled ? "on" : "off"}</dd>
              </div>
            </dl>
          )}
        </Panel>
      )}
    </div>
  );
}
