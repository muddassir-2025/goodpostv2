import { configureStore } from "@reduxjs/toolkit";
import authReducer from "../features/auth/authSlice";
import confirmReducer from "../features/error/confirmSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    confirm: confirmReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});