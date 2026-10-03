import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Highlights",
  description: "Personal knowledge system — highlights, notes, canvas, and more.",
};

const themeInitScript = `
(function() {
  try {
    var saved = localStorage.getItem('hl_theme');
    var theme = saved || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="h-full">{children}</body>
    </html>
  );
}