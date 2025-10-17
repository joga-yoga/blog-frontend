"use client";

import { useEffect } from "react";

import { API_BASE_URL } from "@/lib/env";

const AdminRedirectPage = () => {
  useEffect(() => {
    const redirectUrl = new URL("/admin", API_BASE_URL);

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("t");

      if (token) {
        redirectUrl.searchParams.set("t", token);
      }

      window.location.replace(redirectUrl.toString());
    }
  }, []);

  return <p>Redirecting…</p>;
};

export default AdminRedirectPage;
