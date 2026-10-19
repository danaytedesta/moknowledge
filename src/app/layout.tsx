import type { Metadata } from "next";
import { KnowledgeProvider } from "@/context/knowledge-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "MoKnowledge | Business Knowledge Builder",
  description:
    "Turn your company website into a reviewable business knowledge base for better posts, emails, and articles.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {/* Both knowledge pages can access the same saved-profile state. */}
        <KnowledgeProvider>{children}</KnowledgeProvider>
      </body>
    </html>
  );
}
