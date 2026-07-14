"use client";

import dynamic from "next/dynamic";

/**
 * Client-only dynamic import of the WebGL scene, isolated in its own file
 * so `ssr: false` is legal here (Next 16 forbids it directly inside a
 * Server Component — it has to originate from a "use client" module).
 * A gradient placeholder fills the space while the ~150KB three.js chunk
 * loads, so the hero never pops in empty.
 */
const HeroScene = dynamic(() => import("@/components/hero-scene").then((m) => m.HeroScene), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full animate-pulse rounded-3xl bg-gradient-to-br from-indigo-500/20 via-purple-500/10 to-cyan-400/20" />
  ),
});

export function HeroSceneLoader() {
  return <HeroScene />;
}
