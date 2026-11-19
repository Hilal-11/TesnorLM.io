"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { toast } from "@/components/ui/toast";

/** After onboarding (/app?welcome=1|sample): one calm toast, then the URL is cleaned. */
export function WelcomeToast() {
  const welcome = useSearchParams().get("welcome");
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!welcome) return;
    toast.success(
      welcome === "sample"
        ? "You're set. The sample paper arrives with notebooks in the next update."
        : "You're set. Add a source to start learning.",
    );
    router.replace(pathname);
  }, [welcome, router, pathname]);

  return null;
}
