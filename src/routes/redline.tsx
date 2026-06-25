import { createFileRoute } from "@tanstack/react-router";
import { RedlinePage } from "@/components/redline/RedlinePage";

export const Route = createFileRoute("/redline")({
  head: () => ({
    meta: [
      { title: "DMRC Red Line | Trip Finder" },
      { name: "description", content: "Cyber-cream Red Line crew trip finder for Shadara crew control." },
      { property: "og:title", content: "DMRC Red Line | Trip Finder" },
      { property: "og:description", content: "Find crew duty schedules on DMRC Red Line." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: RedlinePage,
});