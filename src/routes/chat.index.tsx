import { createFileRoute } from "@tanstack/react-router";
import { ChatWorkspace } from "@/components/chat/chat-workspace";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [
      { title: "AI Legal Assistant — Nyaya Sakhi" },
      {
        name: "description",
        content: "Ask legal questions and get answers from verified Indian Acts with citations.",
      },
      { property: "og:title", content: "AI Legal Assistant — Nyaya Sakhi" },
      {
        property: "og:description",
        content: "Ask legal questions and get plain-language answers from verified Indian Acts with citations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <ChatWorkspace />,
});
