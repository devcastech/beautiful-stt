import { AudioProcessor } from './AudioProcessor';
import './App.css';

function App() {
  return (
    <main className="w-full h-full flex flex-col justify-center">
      <div className="pb-8 flex flex-col justify-center items-center">
        <img src="/logo.png" className="w-[80px]" alt="" />
        <h1 className="font-bold text-2xl text-neutral-500">Beautiful Speech to Text</h1>
      </div>
      <AudioProcessor />
      <div className="flex justify-center items-end min-h-32">
        <a href="https://eduar.tech" target="_blank" className="text-neutral-500! hover:underline">
          eduar.tech
        </a>
      </div>
    </main>
  );
}

export default App;
