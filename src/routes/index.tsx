import { createFileRoute } from "@tanstack/react-router";
import { PueiOS } from "@/pueios/PueiOS";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PueiOS 2 Ultimate Edition" },
      { name: "description", content: "An alternate-universe operating system from 2020 — glossy Aero, draggable windows, mascot included." },
    ],
  }),
  component: Index,
});

function Index() {
  return <PueiOS />;
}
