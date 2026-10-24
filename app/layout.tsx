import "./globals.css";
import type { ReactNode } from "react";
import { Providers } from "./providers";
import TopBar from "./TopBar";

export const metadata = {
  title: "Rialo Studio",
  description: "Launch tokens and NFTs on Rialo Testnet",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <TopBar />
          {children}
        </Providers>
      </body>
    </html>
  );
}
