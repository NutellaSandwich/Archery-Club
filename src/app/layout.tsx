import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import NavbarWrapper from "@/components/navbar-wrapper";
import { Toaster } from "sonner";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // ✅ Added `data-scroll-behavior="smooth"`
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <NavbarWrapper /> {/* ✅ Client component */}
          <main className="mx-auto max-w-5xl p-6">{children}</main>
          <Toaster richColors closeButton position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}