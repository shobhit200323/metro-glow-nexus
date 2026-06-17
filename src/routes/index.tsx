import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Splash } from "@/components/splash/Splash";
import { Dashboard } from "@/components/dashboard/Dashboard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DMRC Crew Control Portal · Trip Finder" },
      {
        name: "description",
        content:
          "Delhi Metro Crew Control dashboard — launch Red, Pink, Blue, Yellow, Green, and Violet line trip-finder portals.",
      },
      { property: "og:title", content: "DMRC Crew Control Portal" },
      {
        property: "og:description",
        content: "Futuristic crew dashboard for Delhi Metro line trip finders.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  // Splash stays until the user explicitly clicks. No sessionStorage skip.
  const [showSplash, setShowSplash] = useState(true);
  return (
    <>
      {showSplash && <Splash onDone={() => setShowSplash(false)} />}
      <Dashboard />
    </>
  );
}
