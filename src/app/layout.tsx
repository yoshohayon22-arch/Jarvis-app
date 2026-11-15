import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { Providers } from "@/components/providers";
import { THEME_COLORS, THEME_INIT_SCRIPT } from "@/lib/themes";
import "./globals.css";

// Polices du thème Nuit (par défaut), auto-hébergées par next/font et préchargées.
// Les polices des autres thèmes sont dans src/styles/fonts.css (chargées seulement si le thème est actif).
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

const fontVariables = `${spaceGrotesk.variable} ${inter.variable}`;

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s · Dashboard" },
  description: "Mon dashboard personnel.",
  applicationName: "Dashboard",
  appleWebApp: { capable: true, title: "Dashboard", statusBarStyle: "black-translucent" },
  robots: { index: false, follow: false },
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: THEME_COLORS.nuit,
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr-CH" data-theme="nuit" className={fontVariables} suppressHydrationWarning>
      <head>
        {/* Applique le thème mémorisé avant le premier affichage (pas de flash). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-dvh">
        <a
          href="#contenu"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-control focus:bg-accent focus:px-4 focus:py-2 focus:text-on-accent"
        >
          Aller au contenu
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
