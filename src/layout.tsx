import { Footer } from "./components/Footer";
import { Header } from "./components/Header";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <main className="w-full h-full flex flex-col overflow-auto">
      <Header />
      <div className="flex-1">{children}</div>
      <Footer />
    </main>
  );
}
