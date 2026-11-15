import type { Metadata, Viewport } from "next";
import {
  Archivo_Black,
  Caveat,
  Inter,
  Manrope,
  Patrick_Hand,
  Space_Grotesk,
  Space_Mono,
} from "next/font/google";
import { Providers } from "@/components/providers";
import { THEME_COLORS, THEME_INIT_SCRIPT } from "@/lib/themes";
import "./globals.css";

// Polices des 4 thèmes, auto-hébergées par next/font (aucun appel à Google côté visiteur).
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap", preload: false });
const archivoBlack = Archivo_Black({ subsets: ["latin"], weight: "400", variable: "--font-archivo-black", display: "swap", preload: false });
const spaceMono = Space_Mono({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-space-mono", display: "swap", preload: false });
const caveat = Caveat({ subsets: ["latin"], variable: "--font-caveat", display: "swap", preload: false });
const patrickHand = Patrick_Hand({ subsets: ["latin"], weight: "400", variable: "--font-patrick-hand", display: "swap", preload: false });

const fontVariables = [spaceGrotesk, inter, manrope, archivoBlack, spaceMono, caveat, patrickHand]
  .map((f) => f.variable)
  .join(" ");

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
