"use client";

import { Flame, Hammer } from "lucide-react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const handleLogin = () => {
    localStorage.setItem("clipforge_auth", "true");
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-orange-600/10 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="w-full max-w-md bg-[#0a0a0a] border border-zinc-800 p-8 rounded-lg shadow-2xl relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(249,115,22,0.3)]">
            <Flame className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tighter">CLIPFORGE</h1>
          <p className="text-zinc-500 text-sm mt-2 uppercase tracking-widest font-semibold flex items-center gap-2">
            <Hammer className="w-3 h-3" /> AI Video Factory
          </p>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Username</label>
            <input 
              type="text" 
              defaultValue="carlo@example.com"
              className="w-full bg-black border border-zinc-800 text-white px-4 py-3 rounded focus:outline-none focus:border-orange-500 transition-colors font-mono text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Password</label>
            <input 
              type="password" 
              defaultValue="123456"
              className="w-full bg-black border border-zinc-800 text-white px-4 py-3 rounded focus:outline-none focus:border-orange-500 transition-colors font-mono text-sm"
            />
          </div>
          <button 
            type="submit"
            className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-bold py-3 px-4 rounded mt-4 transition-all duration-300 transform active:scale-95 shadow-[0_0_20px_rgba(234,88,12,0.4)] uppercase tracking-wider text-sm"
          >
            Enter The Forge
          </button>
        </form>
      </div>
    </div>
  );
}
