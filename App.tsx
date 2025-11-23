
import React, { useState, useEffect } from 'react';
import ImageGenerator from './components/ImageGenerator';
import AICritic from './components/AICritic';
import CoverArtGenerator from './components/CoverArtGenerator';
import { UserIcon, LogOutIcon, SettingsIcon, BrushIcon, RobotIcon, ImageIcon, MusicIcon } from './components/Icons';
import { setCookie, getCookie, eraseCookie } from './utils/cookieUtils';
import { User, UserRole } from './types';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Login Form States
  const [usernameInput, setUsernameInput] = useState('');
  const [roleInput, setRoleInput] = useState<UserRole>('editor');
  
  // View State: 'generator' | 'critic' | 'cover-art'
  const [currentView, setCurrentView] = useState<'generator' | 'critic' | 'cover-art'>('generator');
  
  // Global Settings State passed to Components
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    const savedUserStr = getCookie('td_user_data');
    if (savedUserStr) {
      try {
        const parsedUser = JSON.parse(savedUserStr);
        setUser(parsedUser);
      } catch (e) {
        // Fallback for legacy cookies
        const legacyName = getCookie('td_username');
        if (legacyName) {
             setUser({ username: legacyName, role: 'editor' });
        } else {
             setIsModalOpen(true);
        }
      }
    } else {
      setIsModalOpen(true);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (usernameInput.trim()) {
      const newUser: User = {
        username: usernameInput.trim(),
        role: roleInput
      };
      
      setCookie('td_user_data', JSON.stringify(newUser), 30); // Save for 30 days
      setUser(newUser);
      setIsModalOpen(false);
    }
  };

  const handleLogout = () => {
    eraseCookie('td_user_data');
    eraseCookie('td_username'); // Clean legacy
    setUser(null);
    setUsernameInput('');
    setRoleInput('editor');
    setIsModalOpen(true);
  };

  const getRoleLabel = (role: UserRole) => {
      switch(role) {
          case 'admin': return 'Admin';
          case 'editor': return 'Editör';
          case 'viewer': return 'Görüntüleyici';
          default: return 'Kullanıcı';
      }
  };

  const getRoleColor = (role: UserRole) => {
      switch(role) {
          case 'admin': return 'bg-red-500/20 text-red-300 border-red-500/30';
          case 'editor': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
          case 'viewer': return 'bg-green-500/20 text-green-300 border-green-500/30';
          default: return 'bg-slate-500/20 text-slate-300';
      }
  };

  return (
    <div className="min-h-screen bg-darker text-white selection:bg-primary selection:text-white">
      {/* Login Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>
          <div className="relative w-full max-w-md bg-surface border border-white/10 rounded-2xl p-8 shadow-2xl transform transition-all animate-in fade-in zoom-in duration-300">
            <div className="flex flex-col items-center gap-6 mb-8">
              {/* Login Screen Logo - Red box with white brush icon */}
              <div className="w-40 h-40 bg-primary rounded-3xl flex items-center justify-center shadow-[0_0_30px_rgba(220,38,38,0.6)] animate-pulse-fast transform hover:rotate-3 transition-transform duration-500">
                <BrushIcon className="w-24 h-24 text-white drop-shadow-md" />
              </div>
              <div className="text-center">
                <h2 className="text-2xl font-bold text-white">Hoş Geldiniz</h2>
                <p className="text-slate-400 mt-2">TdAnimator'u kullanmak için giriş yapın.</p>
              </div>
            </div>
            
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-slate-300 mb-2">
                  İsim / Kullanıcı Adı
                </label>
                <input
                  type="text"
                  id="username"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  className="w-full bg-darker border border-white/10 rounded-xl p-4 text-white placeholder-slate-500 focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
                  placeholder="Adınız..."
                  autoFocus
                  required
                  maxLength={20}
                />
              </div>
              
              <div>
                  <label htmlFor="role" className="block text-sm font-medium text-slate-300 mb-2">
                      Rol Seçimi
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setRoleInput('admin')}
                        className={`p-3 rounded-xl border text-xs font-bold transition-all ${roleInput === 'admin' ? 'bg-primary text-white border-primary' : 'bg-darker border-white/10 text-slate-400 hover:bg-white/5'}`}
                      >
                          Admin
                      </button>
                      <button
                        type="button"
                        onClick={() => setRoleInput('editor')}
                        className={`p-3 rounded-xl border text-xs font-bold transition-all ${roleInput === 'editor' ? 'bg-primary text-white border-primary' : 'bg-darker border-white/10 text-slate-400 hover:bg-white/5'}`}
                      >
                          Editör
                      </button>
                      <button
                        type="button"
                        onClick={() => setRoleInput('viewer')}
                        className={`p-3 rounded-xl border text-xs font-bold transition-all ${roleInput === 'viewer' ? 'bg-primary text-white border-primary' : 'bg-darker border-white/10 text-slate-400 hover:bg-white/5'}`}
                      >
                          İzleyici
                      </button>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2 text-center">
                      {roleInput === 'admin' && "Tam yetkili. Silme, düzenleme ve oluşturma."}
                      {roleInput === 'editor' && "Oluşturma ve düzenleme. Silme yetkisi yok."}
                      {roleInput === 'viewer' && "Sadece görüntüleme. Oluşturma ve silme kapalı."}
                  </p>
              </div>

              <button
                type="submit"
                disabled={!usernameInput.trim()}
                className="w-full bg-primary hover:bg-primaryHover disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg shadow-primary/10 mt-4"
              >
                Başla
              </button>
            </form>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-50 bg-dark/90 backdrop-blur-md border-b border-white/10 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center gap-6">
              {/* Header Logo */}
              <div 
                onClick={() => setCurrentView('generator')}
                className="flex items-center gap-4 cursor-pointer group"
              >
                <div className="h-12 w-12 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/30 group-hover:scale-105 transition-transform duration-300">
                  <BrushIcon className="w-7 h-7 text-white" />
                </div>
                <div className="hidden sm:block">
                  <h1 className="text-2xl font-bold tracking-tight text-white group-hover:text-primary transition-colors">TdAnimator</h1>
                  <p className="text-[10px] text-slate-400 leading-none tracking-wide uppercase">by Tda Company</p>
                </div>
              </div>

              {/* View Switcher */}
              <div className="flex items-center bg-white/5 rounded-xl p-1 border border-white/5">
                  <button
                    onClick={() => setCurrentView('generator')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${currentView === 'generator' ? 'bg-surface text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                  >
                    <ImageIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">Oluşturucu</span>
                  </button>
                  <button
                    onClick={() => setCurrentView('critic')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${currentView === 'critic' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20' : 'text-slate-400 hover:text-indigo-400'}`}
                  >
                    <RobotIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">Yapay Zeka</span>
                  </button>
                  <button
                    onClick={() => setCurrentView('cover-art')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${currentView === 'cover-art' ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20' : 'text-slate-400 hover:text-purple-400'}`}
                  >
                    <MusicIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">Şarkı Kapağı</span>
                  </button>
              </div>
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center gap-4">
               {/* Global Settings Trigger - Only show for generator and critic */}
               {currentView !== 'cover-art' && (
                 <button 
                    onClick={() => setIsSettingsOpen(true)}
                    className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all relative group"
                    title={currentView === 'generator' ? "Görüntü Ayarları" : "AI Analiz Ayarları"}
                  >
                    <SettingsIcon className="w-6 h-6" />
                    <span className="absolute top-full right-0 mt-2 w-max px-2 py-1 text-xs text-white bg-surface border border-white/10 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl z-50">
                      {currentView === 'generator' ? "Görüntü Ayarları" : "AI Analiz Ayarları"}
                    </span>
                  </button>
               )}

              {/* User Profile Section */}
              {user && (
                <div className="flex items-center gap-4 border-l border-white/10 pl-4">
                  <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/10">
                    <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-xs font-bold text-white">
                      <UserIcon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-200 leading-none">{user.username}</span>
                        <span className={`text-[9px] px-1 rounded border mt-0.5 w-fit ${getRoleColor(user.role)}`}>
                            {getRoleLabel(user.role)}
                        </span>
                    </div>
                  </div>
                  <button 
                    onClick={handleLogout}
                    className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    title="Çıkış Yap"
                  >
                    <LogOutIcon className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 transition-opacity duration-500 ${isModalOpen ? 'opacity-0' : 'opacity-100'}`}>
        <div className="flex flex-col gap-8">
          {currentView === 'generator' && (
             <>
                <div className="text-center max-w-2xl mx-auto space-y-4 mb-4">
                  <h2 className="text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-400">
                    Hayal gücünüzü gerçeğe dönüştürün
                  </h2>
                  <p className="text-lg text-slate-400">
                    Tda Company'nin geliştirdiği TdAnimator ile saniyeler içinde yüksek kaliteli, fotogerçekçi görüntüler oluşturun.
                  </p>
                </div>
                
                <ImageGenerator 
                  isSettingsOpen={isSettingsOpen} 
                  onSettingsClose={() => setIsSettingsOpen(false)} 
                  user={user}
                />
             </>
          )}

          {currentView === 'critic' && (
             <AICritic 
                user={user}
                isSettingsOpen={isSettingsOpen}
                onSettingsClose={() => setIsSettingsOpen(false)}
             />
          )}

          {currentView === 'cover-art' && (
             <CoverArtGenerator user={user} />
          )}
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
