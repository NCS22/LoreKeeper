import type { Metadata } from "next";
import { Alegreya, Atkinson_Hyperlegible_Next } from "next/font/google";
import { en } from "@messages/en";
import { PREFERENCES_INIT_SCRIPT } from "@/accessibility/preferences-init-script";
import "./globals.css";

const alegreya = Alegreya({
  variable: "--font-alegreya",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

const atkinson = Atkinson_Hyperlegible_Next({
  variable: "--font-atkinson",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: en.app.name,
  description: en.app.tagline,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-bg="obsidian"
      data-text="vellum"
      className={`${alegreya.variable} ${atkinson.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREFERENCES_INIT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
