"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { Flame, CheckCircle2 } from "lucide-react";

export function OssPopup() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Esconde o popup depois de 4 segundos para dar tempo da animação brilhar
    const timer = setTimeout(() => {
      setVisible(false);
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.8 } }}
          className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
        >
          {/* Fundo escurecido e com blur extremo */}
          <motion.div 
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(20px)" }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
            transition={{ duration: 0.6 }}
            className="absolute inset-0 bg-black/70"
          />
          
          <div className="relative flex flex-col items-center justify-center scale-150">
            {/* Efeitos de labaredas no fundo - Pulso de luz intensa */}
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ 
                scale: [1, 1.5, 1.2],
                opacity: [0, 1, 0.4]
              }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              className="absolute bg-gradient-to-t from-orange-600 via-yellow-500 to-red-600 blur-[80px] rounded-full w-96 h-96 -z-10 mix-blend-screen"
            />
            
            {/* Texto OSS */}
            <motion.div
              initial={{ scale: 0.2, y: 100, rotateX: 90 }}
              animate={{ scale: 1, y: 0, rotateX: 0 }}
              exit={{ scale: 1.5, opacity: 0, filter: "blur(20px)" }}
              transition={{ 
                type: "spring", 
                stiffness: 150, 
                damping: 10, 
                mass: 1.5,
                delay: 0.1 
              }}
              className="relative flex items-center justify-center"
            >
              <h1 
                className="text-8xl md:text-[160px] font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-yellow-300 to-orange-600 drop-shadow-[0_20px_50px_rgba(249,115,22,1)] uppercase"
                style={{ WebkitTextStroke: "3px #450a0a" }}
              >
                OSS!
              </h1>
              
              {/* Ícones de chama ao redor refinados */}
              <motion.div 
                initial={{ opacity: 0, scale: 0, rotate: -45 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ delay: 0.5, type: "spring", bounce: 0.6 }}
                className="absolute -top-10 -right-12 text-yellow-400 drop-shadow-[0_0_20px_rgba(250,204,21,0.8)]"
              >
                <Flame className="w-24 h-24 animate-[pulse_1s_infinite]" />
              </motion.div>
              <motion.div 
                initial={{ opacity: 0, scale: 0, rotate: 45 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ delay: 0.6, type: "spring", bounce: 0.6 }}
                className="absolute -bottom-5 -left-12 text-orange-600 drop-shadow-[0_0_20px_rgba(234,88,12,0.8)]"
              >
                <Flame className="w-20 h-20 animate-[pulse_1.2s_infinite]" />
              </motion.div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1, duration: 0.5 }}
              className="mt-8 flex items-center gap-3 bg-black/80 px-8 py-3 rounded-full border border-orange-500/50 backdrop-blur-xl shadow-[0_0_30px_rgba(249,115,22,0.3)]"
            >
              <CheckCircle2 className="w-5 h-5 text-orange-500" />
              <p className="text-sm font-bold tracking-[0.2em] text-zinc-100 uppercase">
                Video Forged Successfully
              </p>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
