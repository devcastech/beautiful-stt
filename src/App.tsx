import { AudioProcessor } from './AudioProcessor';
import { ThemeToggle } from './components/ThemeToggle';
import './App.css';

function App() {
  return (
    <main className="w-full h-full flex flex-col overflow-auto">
      <header className="flex items-center justify-between px-8 py-4">
        <div className="flex items-center gap-3">
          <img src="/logo.png" className="w-5 h-5 object-contain opacity-70" alt="" />
          <h1 className="font-mono text-sm font-bold">Beautiful STT</h1>
        </div>
      </header>
      <div className="flex-1">
        <AudioProcessor />
      </div>
      <footer className="grid grid-cols-3 items-center px-8 py-3">
        <div />
        <div className="flex justify-center items-center gap-1.5">
          <span className="text-xs text-muted">by</span>
          <a
            href="https://eduar.tech"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs"
          >
            eduar.tech
          </a>
        </div>
        <div className="flex justify-end">
          <ThemeToggle />
        </div>
      </footer>
    </main>
  );
}

export default App;
