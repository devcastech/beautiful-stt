import { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './App.css';
import { AudioProcessor } from './AudioUpload';

function App() {
  useEffect(() => {
    invoke('greet', { name: 'Edu' }).then((message) => console.log(message));
  }, []);

  return (
    <main className="w-full h-full flex flex-col justify-center">
      <div className='pb-8 flex flex-col justify-center items-center'>
        <img src="/logo.png" className='w-[80px]' alt="" />
        <h1 className='font-bold text-2xl text-neutral-500'>Beautiful Speech to Text</h1>
      </div>
      <AudioProcessor/>
      <div className="flex justify-center items-end min-h-32">
        <a
          href='https://eduar.tech'
          target='_blank'
          className='text-neutral-500! hover:underline'>eduar.tech
        </a> 
      </div>
    </main>
  );
}

export default App;
