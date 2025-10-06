import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Script from 'next/script';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin']
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin']
});

export const metadata: Metadata = {
  metadataBase: new URL('https://plan5.example.com'),
  title: {
    default: 'Plan5 Platform',
    template: '%s | Plan5'
  },
  description: 'Modern hospitality tooling for Plan5 managed properties.',
  applicationName: 'Plan5',
  generator: 'Next.js',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ rel: 'icon', type: 'image/svg+xml', url: '/icon.svg' }],
    shortcut: ['/icon.svg'],
    apple: [{ rel: 'apple-touch-icon', url: '/icon.svg' }]
  }
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Script
          src="https://js.hcaptcha.com/1/api.js"
          strategy="lazyOnload"
          data-cfasync="false"
        />
        {children}
      </body>
    </html>
  );
}
