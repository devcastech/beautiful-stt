import { AudioProcessor } from './AudioProcessor';
import './App.css';
import { Header } from './components/Header';
import { Footer } from './components/Footer';

function App() {
  return (
    <main className="w-full h-full flex flex-col overflow-auto">
      <Header />
      <div className="flex-1">
        <AudioProcessor />
      </div>
      <Footer />
    </main>
  );
}

export default App;
