import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dongguk University Student Assistant",
  description: "학생회·동아리 예산 집행 관리 시스템",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full bg-background text-foreground">{children}</body>
    </html>
  );
}
