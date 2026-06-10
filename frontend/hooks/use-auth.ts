"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import type { User } from "@/lib/types";
import { useAuthStore } from "@/stores/auth-store";

export function useAuth({ required = true }: { required?: boolean } = {}) {
  const { user, isLoading, setUser } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setUser(null);
      if (required) router.push("/login");
      return;
    }

    if (!user) {
      apiFetch<User>("/api/auth/me")
        .then(setUser)
        .catch(() => {
          setUser(null);
          if (required) router.push("/login");
        });
    }
  }, [user, required, router, setUser]);

  return { user, isLoading };
}
