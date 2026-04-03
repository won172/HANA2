import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hana Campus Budget",
  description: "하나은행 톤의 학생회·동아리 예산 운영 플랫폼",
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
