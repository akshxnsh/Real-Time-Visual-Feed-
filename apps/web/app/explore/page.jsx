import { redirect } from "next/navigation";

export default function ExploreRedirect({ searchParams }) {
  const raw = searchParams?.topic;
  const topic = Array.isArray(raw) ? raw[0] : raw;
  if (topic && typeof topic === "string" && topic.trim()) {
    redirect(`/?topic=${encodeURIComponent(topic.trim())}`);
  }
  redirect("/");
}
