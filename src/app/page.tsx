import { redirect } from "next/navigation";

export default function HomePage() {
  // Keep one builder implementation for both entry URLs.
  redirect("/knowledge");
}
