import { createFileRoute } from "@tanstack/react-router";
import { ChatWorkspace } from "@/components/chat/chat-workspace";

export const Route = createFileRoute("/_authenticated/chat/$threadId")({
  head: () => ({
    meta: [
      { title: "Conversation — Nyaya Sakhi" },
      {
        name: "description",
        content: "Your saved legal conversation with citations from verified Indian Acts.",
      },
      { property: "og:title", content: "Conversation — Nyaya Sakhi" },
      {
        property: "og:description",
        content: "Your saved legal conversation with citations from verified Indian Acts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <ChatThreadPage />,
});

function ChatThreadPage() {
  const { threadId } = Route.useParams();
  return <ChatWorkspace threadId={threadId} />;
}
