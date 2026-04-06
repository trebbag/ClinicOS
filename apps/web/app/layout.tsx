import "./globals.css";
import { AuthProvider, AuthShell } from "../components/auth-provider";

export const metadata = {
  title: "Clinic OS",
  description: "Internal clinic operating system scaffold"
};

export default function RootLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <AuthShell>{children}</AuthShell>
        </AuthProvider>
      </body>
    </html>
  );
}
