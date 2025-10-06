export const metadata = {
  title: 'Plan5',
  description: 'Plan5 Webanwendung',
  icons: {
    icon: '/icon.svg',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
