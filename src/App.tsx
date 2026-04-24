/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useEffect } from 'react';
import Background from './components/Background';
import { cn } from './lib/utils';
import { Terminal, Database, Activity, User, FileText, BookOpen } from 'lucide-react';

// --- HELPERS ---

const RUNES = "ᚢᚦᚨᚱᚲᚷᚹᚺᚻᚾᛁᛂᛃᛄᛅᛆᛇᛈᛉᛊᛋᛌᛍᛎᛏᛐᛑᛒᛓᛔᛕᛖᛗᛘᛙᛚᛛᛜᛝᛞᛟᛠᛡᛢᛣᛤᛥᛦᛧᛨᛩᛪ";

function GlyphText({ text, active }: { text: string; active: boolean }) {
  const [display, setDisplay] = useState(text);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    let interval: any;
    if (isHovered || active) {
      let iteration = 0;
      interval = setInterval(() => {
        setDisplay(text.split("").map((char, index) => {
          if (index < iteration) return text[index];
          // Use more blocky characters for "pixelated" feel
          return "█▓▒░#$@&"[Math.floor(Math.random() * 8)];
        }).join(""));
        
        if (iteration >= text.length) clearInterval(interval);
        iteration += text.length / 20;
      }, 40);
    } else {
      setDisplay(text.split("").map(() => RUNES[Math.floor(Math.random() * RUNES.length)]).join(""));
    }
    return () => clearInterval(interval);
  }, [isHovered, text, active]);

  return (
    <span 
      onMouseEnter={() => setIsHovered(true)} 
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "transition-all duration-500 tracking-widest",
        (isHovered || active) ? "text-white scale-110" : "text-eldritch-green/60"
      )}
    >
      {display}
    </span>
  );
}

// --- MAIN APP ---

export default function App() {
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [morphState, setMorphState] = useState(0);

  const menuItems = useMemo(() => [
    { id: 'projects', label: 'Projects', icon: <Terminal />, morph: 1 },
    { id: 'blog', label: 'My Blog', icon: <BookOpen />, morph: 2 },
    { id: 'resume', label: 'My Professional Resume', icon: <Database />, morph: 1.5 },
    { id: 'links', label: 'SIGNAL_LINK', icon: <Activity />, morph: 0.5 },
    { id: 'bio', label: 'About Me', icon: <User />, morph: 0 },
  ], []);

  // Calculate even angles for the items
  const arrangedItems = useMemo(() => {
    return menuItems.map((item, index) => ({
      ...item,
      angle: (index * 2 * Math.PI) / menuItems.length - Math.PI / 2
    }));
  }, [menuItems]);

  const handleHover = (item: typeof menuItems[0] | null) => {
    setActiveTab(item?.id || null);
    if (item) setMorphState(item.morph);
  };

  return (
    <main className="hub-container crt text-eldritch-green font-sans overflow-hidden">
      <Background morphState={morphState} />
      
      {/* Overlay Scanline */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)] opacity-40" />

      {/* Center UI focus */}
      <div className="relative z-10 flex items-center justify-center w-full h-full">
        
        {/* Dynamic Title - Pushed to the absolute top edge for clarity */}
        <div className="absolute top-4 md:top-6 text-center w-full select-none">
          <h1 className="text-3xl md:text-5xl font-display font-bold text-white drop-shadow-[0_0_15px_#00ff41] px-4 uppercase tracking-tighter transition-all duration-700">
            {activeTab ? arrangedItems.find(i => i.id === activeTab)?.label.replace('.', '_') : "LOUIS.HAM//WELCOME"}
          </h1>
          <div className="h-[1px] w-20 bg-eldritch-green/30 mx-auto mt-2 mb-2" />
          <p className="text-[8px] tracking-[0.4em] opacity-40 uppercase animate-pulse">
             Computers, Lovecraftian Fiction, Cyberpunk, and My Portfolio
          </p>
        </div>

        {/* Circular Menu - Perfectly centered around the 3D core */}
        <div className="relative w-full h-full flex items-center justify-center">
          {arrangedItems.map((item) => {
            // Expanded radius to make room for central core
            const radius = activeTab === item.id ? 200 : 170;
            const x = Math.cos(item.angle) * radius;
            const y = Math.sin(item.angle) * radius;
            const isTabActive = activeTab === item.id;
            
            return (
              <div 
                key={item.id}
                className="absolute transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]"
                style={{ 
                  transform: `translate(${x}px, ${y}px)`,
                  zIndex: isTabActive ? 20 : 10
                }}
                onMouseEnter={() => handleHover(item)}
                onMouseLeave={() => handleHover(null)}
              >
                <div className={cn(
                  "flex flex-col items-center gap-3 cursor-crosshair group p-2 transition-all duration-500",
                  isTabActive ? "scale-110" : "opacity-70 grayscale group-hover:opacity-100 group-hover:grayscale-0"
                )}>
                  <div className={cn(
                    "p-4 rounded-full border-2 transition-all duration-500 relative",
                    isTabActive ? "bg-eldritch-green text-void-black border-white shadow-[0_0_30px_#00ff41]" : "border-eldritch-green/50 bg-void-black/70"
                  )}>
                    {item.icon}
                    {/* Pulsing ring for active item */}
                    {isTabActive && (
                      <div className="absolute inset-[-4px] border border-white/40 rounded-full animate-ping" />
                    )}
                  </div>
                  <div className="font-bold text-[10px] tracking-[0.2em] bg-void-black/80 px-2 py-1 backdrop-blur-sm">
                    <GlyphText text={item.label} active={isTabActive} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Dynamic description box - Positioned at absolute bottom of viewport */}
        <div className="absolute bottom-2 md:bottom-4 w-full max-w-lg text-center px-4">
          <div className={cn(
            "p-5 border border-eldritch-green/20 bg-void-black/80 backdrop-blur-md transition-all duration-500",
            activeTab ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          )}>
            <div className="flex items-center gap-4 mb-2">
              <Activity size={16} className="animate-pulse" />
              <span className="text-[10px] tracking-widest text-[#00f2ff]">DECRYPTING_BIO_LINK...</span>
            </div>
            <p className="text-sm font-light opacity-80 leading-relaxed uppercase tracking-tighter">
              {activeTab === 'projects' && "Accessing the matrix. Repository of non-euclidean code and reality-warping algorithms."}
              {activeTab === 'blog' && "Retrieving lost logs. Voices from the deep-web sensory arrays and eldritch substrates."}
              {activeTab === 'resume' && "Memory allocation analysis. The evolution of a neural hacker through digital epochs."}
              {activeTab === 'bio' && "Jacked into the core. Human wetware localized in the silicon void."}
            </p>
          </div>
        </div>

      </div>

      {/* Decorative circuitry sigils in corners */}
      <div className="fixed top-0 left-0 p-8 opacity-20 pointer-events-none">
        <FileText size={48} className="rotate-12" />
        <div className="text-[10px] mt-2">SYS_666_VOID_INIT</div>
      </div>
      <div className="fixed bottom-0 right-0 p-8 opacity-20 pointer-events-none">
        <Terminal size={48} className="-rotate-12" />
        <div className="text-[10px] mt-2 text-right">CONNECTION::STABLE</div>
      </div>
    </main>
  );
}

