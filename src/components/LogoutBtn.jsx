import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import authService from "../services/auth";
import { logout } from "../features/auth/authSlice";

export default function LogoutBtn({ className }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  async function handleLogout() {
    await authService.logout();
    dispatch(logout());
    navigate("/");
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className={
        className ||
        "rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-white/20 hover:bg-white/5 hover:text-white"
      }
    >
      Logout
    </button>
  );
}
