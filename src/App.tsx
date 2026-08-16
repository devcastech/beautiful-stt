import { AudioProcessor } from './AudioProcessor';
import { ThemeToggle } from './components/ThemeToggle';
import './App.css';
import { Header } from './components/Header';

function App() {
  return (
    <main className="w-full h-full flex flex-col overflow-auto">
      <Header />
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
