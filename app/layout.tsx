import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fact Friends",
  description: "Friendly math fact practice for every learner",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
