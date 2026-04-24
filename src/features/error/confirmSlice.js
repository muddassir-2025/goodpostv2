import { createSlice } from "@reduxjs/toolkit";

const confirmSlice = createSlice({
  name: "confirm",
  initialState: {
    open: false,
    message: "",
    requiredInput: "",

    toast: {
      open: false,
      message: "",
      type: "info",
    },
  },
  reducers: {
    showConfirm: (state, action) => {
      state.open = true;
      if (typeof action.payload === "string") {
        state.message = action.payload;
        state.requiredInput = "";
      } else {
        state.message = action.payload.message;
        state.requiredInput = action.payload.requiredInput || "";
      }
    },
    hideConfirm: (state) => {
      state.open = false;
      state.message = "";
      state.requiredInput = "";
    },

    showToast: (state, action) => {
      state.toast.open = true;
      state.toast.message = action.payload.message;
      state.toast.type = action.payload.type || "info";
    },
    hideToast: (state) => {
      state.toast.open = false;
      state.toast.message = "";
    },
  },
});

export const { showConfirm, hideConfirm, showToast, hideToast } = confirmSlice.actions;
export default confirmSlice.reducer;