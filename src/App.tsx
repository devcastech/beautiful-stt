import { AudioProcessor } from './AudioProcessor';
import './App.css';

function App() {
  return (
    <main className="w-full h-full flex flex-col overflow-auto">
      <header className="flex items-center justify-between px-8 py-4 border-b border-line">
        <div className="flex items-center gap-3">
          <img src="/logo.png" className="w-5 h-5 object-contain opacity-70" alt="" />
          <span className="text-sm font-medium tracking-tight">Beautiful STT</span>
        </div>
      </header>
      <div className="flex-1">
        <AudioProcessor />
      </div>
      <footer className="flex justify-center items-center gap-1.5 px-8 py-3">
        <span className="text-xs text-muted">by</span>
        <a href="https://eduar.tech" target="_blank" className="text-xs">
          eduar.tech
        </a>
      </footer>
    </main>
  );
}

export default App;
