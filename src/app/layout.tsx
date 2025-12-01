import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SnapFund Status',
  description: 'SnapFund 서비스 상태 페이지',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-white dark:bg-gray-950">
        <div className="max-w-3xl mx-auto px-4 py-8">
          {/* Header */}
          <header className="mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  SnapFund Status
                </h1>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main>{children}</main>

          {/* Footer */}
          <footer className="mt-16 pt-8 border-t border-gray-200 dark:border-gray-800">
            <div className="flex justify-between text-sm text-gray-500">
              <a
                href="https://snapfund.xyz"
                className="hover:text-gray-700 dark:hover:text-gray-300"
              >
                SnapFund.xyz
              </a>
              <a
                href="https://help.snapfund.xyz"
                className="hover:text-gray-700 dark:hover:text-gray-300"
              >
                고객센터
              </a>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
