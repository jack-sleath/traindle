import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = "https://jack-sleath.github.io/traindle";
const ogImageUrl = `${siteUrl}/og-image.png`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Traindle",
  description: "Guess the UK railway station — a daily Wordle-style game",
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "Traindle",
    title: "Traindle",
    description: "Guess the UK railway station — a daily Wordle-style game",
    images: [
      {
        url: ogImageUrl,
        width: 1200,
        height: 630,
        alt: "Traindle — guess the UK railway station",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Traindle",
    description: "Guess the UK railway station — a daily Wordle-style game",
    images: [ogImageUrl],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Prevent flash of unstyled content: apply dark class before first paint */}
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('theme');if(t==='dark'||(t===null&&matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}`,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
