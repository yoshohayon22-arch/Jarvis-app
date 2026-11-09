import type { Metadata, Viewport } from "next";
import { Inter, Orbitron } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const orbitron = Orbitron({ variable: "--font-orbitron", subsets: ["latin"], weight: ["500", "700", "900"] });

export const metadata: Metadata = {
  title: "Le Cerveau",
  description: "Mon second cerveau : je jette mes infos, l'IA les range, les relie et me les montre.",
  applicationName: "Le Cerveau",
  appleWebApp: { capable: true, title: "Le Cerveau", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#03050b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className={`${inter.variable} ${orbitron.variable} antialiased`}>{children}</body>
    </html>
  );
}
