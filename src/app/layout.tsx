import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import NavbarWrapper from "@/components/navbar-wrapper";
import { Toaster } from "sonner";
import { AuthProvider } from "@/components/AuthProvider";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>
        {/* 🔥 AuthProvider MUST wrap the whole app before NavbarWrapper */}
        <AuthProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <NavbarWrapper /> {/* Navbar now waits for auth to load properly */}
            <main className="mx-auto max-w-5xl p-6">{children}</main>
            <Toaster richColors closeButton position="top-center" />
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}