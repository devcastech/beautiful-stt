import { AudioProcessor } from './AudioProcessor';
import './App.css';

function App() {
  return (
    <main className="w-full h-full flex flex-col justify-between overflow-auto">
      <div className="flex flex-col justify-start items-center lg:items-start px-8">
        <img src="/logo.png" className="w-[80px]" alt="" />
      </div>
      <AudioProcessor />
      <div className="flex justify-center items-center flex-col min-h-32">
        <h1 className="font-bold text-2xl text-neutral-500">Beautiful Speech to Text</h1>
        <a href="https://eduar.tech" target="_blank" className="text-neutral-500! hover:underline">
          eduar.tech
        </a>
      </div>
    </main>
  );
}

export default App;
