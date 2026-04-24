import { store } from "./App/store";
import { showConfirm, hideConfirm, showToast, hideToast } from "./features/error/confirmSlice";

let resolver = null;

export function confirm(options) {
  const payload = typeof options === "string" ? options : options;
  store.dispatch(showConfirm(payload));

  return new Promise((resolve) => {
    resolver = resolve;
  });
}

export function confirmYes() {
  resolver?.(true);
  resolver = null;
  store.dispatch(hideConfirm());
}

export function toast(message, type = "info") {
  store.dispatch(showToast({ message, type }));
  setTimeout(() => {
    store.dispatch(hideToast());
  }, 3000);
}

export function confirmNo() {
  resolver?.(false);
  resolver = null;
  store.dispatch(hideConfirm());
}