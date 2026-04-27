import { create } from "zustand";

export interface User {
  id: number;
  email: string;
  full_name: string | null;
  is_admin: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (token: string, user: User) => void;
  setUser: (user: User | null) => void;
  logout: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  token: typeof window !== "undefined" ? localStorage.getItem("dm_token") : null,
  setAuth: (token, user) => {
    localStorage.setItem("dm_token", token);
    set({ token, user });
  },
  setUser: (user) => set({ user }),
  logout: () => {
    localStorage.removeItem("dm_token");
    set({ token: null, user: null });
  },
}));
