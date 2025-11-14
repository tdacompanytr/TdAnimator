import React from 'react';
import ImageGenerator from './components/ImageGenerator';
import { SparklesIcon } from './components/Icons';

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-darker text-white selection:bg-primary selection:text-white">
      <header className="sticky top-0 z-50 bg-dark/80 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/20 rounded-lg">
                <SparklesIcon className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">TdAnimator</h1>
                <p className="text-[10px] text-slate-400 leading-none">by Tda Company</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col gap-8">
          <div className="text-center max-w-2xl mx-auto space-y-4">
            <h2 className="text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-400">
              Hayal gücünüzü gerçeğe dönüştürün
            </h2>
            <p className="text-lg text-slate-400">
              Tda Company'nin geliştirdiği TdAnimator ile saniyeler içinde yüksek kaliteli, fotogerçekçi görüntüler oluşturun.
            </p>
          </div>
          
          <ImageGenerator />
        </div>
      </main>

      <footer className="mt-auto border-t border-white/5 py-8 bg-dark">
        <div className="max-w-7xl mx-auto px-4 text-center text-slate-500 text-sm">
          <p>&copy; {new Date().getFullYear()} TdAnimator. <span className="text-slate-400 font-medium">Tda Company</span> tarafından geliştirilmiştir. Tüm hakları saklıdır.</p>
        </div>
      </footer>
    </div>
  );
};

export default App;