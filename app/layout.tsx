import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gridly - Smart Spreadsheet",
  description: "A modern spreadsheet application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
