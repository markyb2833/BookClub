"use client";

import { useEffect, useState } from "react";

/** Library wall + shelf modals switch to full-screen layouts below this width. */
export function useNarrowLibrary(breakpointPx = 720) {
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpointPx}px)`);
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [breakpointPx]);

  return narrow;
}
