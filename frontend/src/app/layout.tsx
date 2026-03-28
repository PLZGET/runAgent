import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "탈출 마스터",
  description: "퇴사 타이밍과 이직 가능성을 정리해주는 해커톤 MVP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
