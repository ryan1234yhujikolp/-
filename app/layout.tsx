import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "온라인 학생회",
  description: "온라인 학생회 - 일정, 공지사항, 업무실, 임원회의실, 학생 광장, 건의함",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
