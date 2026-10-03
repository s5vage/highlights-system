import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Highlights",
  description: "Personal knowledge system — highlights, notes, canvas, and more.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="h-full">{children}</body>
    </html>
  );
}
