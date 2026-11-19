import { Credits } from "./components/Credits";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-full h-full flex">
      <Sidebar />
      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        <main className="flex-1 min-h-0">{children}</main>
        <Credits />
      </div>
      <Header />
    </div>
  );
}
