import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastProvider } from "@/components/toast";
import { ConfirmProvider } from "@/components/confirm";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { ConsentBanner } from "@/components/consent-banner";

export const metadata: Metadata = {
  title: "vainie — surelynotvain's corner of the internet",
  description:
    "surelynotvain — webdev, appdev, it support, server maintenance, ai engineer & researcher from poland. projects, blog, contact.",
  metadataBase: new URL("https://vainie.pl"),
  openGraph: {
    title: "vainie",
    description: "surelynotvain's corner of the internet.",
    url: "https://vainie.pl",
    siteName: "vainie",
    type: "website",
  },
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      style={
        {
          "--font-sans": GeistSans.style.fontFamily,
          "--font-mono": GeistMono.style.fontFamily,
        } as React.CSSProperties
      }
    >
      <body className="font-sans antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[300] focus:px-3 focus:py-2 focus:rounded-md focus:bg-app focus:border focus:border-default focus:text-sm focus:font-medium"
        >
          skip to content
        </a>
        <ThemeProvider>
          <ToastProvider>
            <ConfirmProvider>
              <Nav />
              <main id="main" className="pt-20">{children}</main>
              <Footer />
              <ConsentBanner />
            </ConfirmProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
