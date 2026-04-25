import { Component } from "react";
import { Link } from "react-router-dom";

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error("UI render error:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-black px-4 text-white">
          <div className="w-full max-w-md rounded-[32px] border border-white/10 bg-[#121212]/92 p-6 text-center shadow-[0_30px_90px_rgba(0,0,0,0.34)]">
            <p className="text-xs uppercase tracking-[0.32em] text-zinc-500">GoodPost</p>
            <h1 className="font-display mt-4 text-3xl text-white">Something broke in the feed</h1>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              The page hit a rendering problem. Reloading should usually recover it.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-full bg-zinc-100 px-5 py-3 text-sm font-semibold !text-zinc-950 transition hover:bg-zinc-200 hover:!text-zinc-950"
              >
                Reload
              </button>
              <Link
                to="/"
                className="rounded-full border border-white/10 px-5 py-3 text-sm font-medium text-zinc-300 transition hover:border-white/20 hover:text-white"
              >
                Home
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
