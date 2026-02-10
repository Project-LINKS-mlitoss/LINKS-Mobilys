import { create } from "zustand";

export const useSnackbarStore = create((set) => ({
  open: false,
  title: "",
  details: "",
  severity: "success", // success | error | warning | info
  showSnackbar: ({ title, detail = "", severity = "success" }) =>
    set({ open: true, title, detail, severity }),
  closeSnackbar: () => set({ open: false }),
}));
