import { Outlet } from "react-router-dom";
import BottomNav from "./BottomNav";
import Navbar from "./Navbar";

export default function AppShell() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(255,94,58,0.15),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(255,0,128,0.12),_transparent_35%),linear-gradient(180deg,#050505_0%,#000_55%,#050505_100%)]" />
      <Navbar />
      <main className="mx-auto w-full max-w-6xl px-3 pb-28 pt-20 sm:px-5 md:pb-32 md:pt-24">
        <div className="mx-auto w-full max-w-[540px]">
          <Outlet />
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
