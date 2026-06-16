import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    try {
      if (sessionStorage.getItem("dmrc-splash-shown") === "1") {
        setShowSplash(false);
      }
    } catch {}
  }, []);

  const handleSplashDone = () => {
    try {
      sessionStorage.setItem("dmrc-splash-shown", "1");
    } catch {}
    setShowSplash(false);
  };

  return (
    <>
      {showSplash && <Splash onDone={handleSplashDone} />}
      <Dashboard />
    </>
  );
}
