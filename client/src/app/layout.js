import './globals.css';
import PageTracker from '../components/PageTracker';
import ConnectionBanner from '../components/ui/ConnectionBanner';

export const metadata = {
  title: 'CompuGlobalHyperMegaNet',
  description: 'The internet... on a computer!',
  icons: { icon: '/favicon.svg', apple: '/icons/icon-192.png' },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'CGHMN',
  },
};

export const viewport = {
  themeColor: '#1e1f22',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <PageTracker />
        <ConnectionBanner />
        {children}
      </body>
    </html>
  );
}
