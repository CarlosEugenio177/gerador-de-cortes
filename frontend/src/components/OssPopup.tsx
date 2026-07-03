"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { Flame } from "lucide-react";

export function OssPopup() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Esconde o popup depois de 3.5 segundos
    const timer = setTimeout(() => {
      setVisible(false);
    }, 3500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5, y: 50 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 1.5, filter: "blur(10px)" }}
          transition={{ duration: 0.5, type: "spring", bounce: 0.5 }}
          className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
        >
          {/* Fundo levemente escurecido para dar destaque */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          
          <div className="relative flex flex-col items-center justify-center">
            {/* Efeitos de labaredas no fundo */}
            <motion.div
              animate={{ 
                scale: [1, 1.2, 1],
                rotate: [0, 5, -5, 0],
                opacity: [0.5, 0.8, 0.5]
              }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="absolute -inset-20 bg-gradient-to-t from-orange-600 via-red-600 to-transparent blur-[60px] rounded-full opacity-50 -z-10"
            />
            
            {/* Texto OSS */}
            <motion.div
              initial={{ rotateX: 90 }}
              animate={{ rotateX: 0 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="relative flex items-center justify-center"
            >
              <h1 
                className="text-8xl md:text-[150px] font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 via-orange-500 to-red-700 drop-shadow-[0_10px_20px_rgba(220,38,38,0.8)] uppercase"
                style={{ WebkitTextStroke: "2px #450a0a" }}
              >
                OSS!
              </h1>
              
              {/* Ícones de chama ao redor */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="absolute -top-10 -right-10 text-orange-500"
              >
                <Flame className="w-20 h-20 animate-pulse" />
              </motion.div>
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="absolute -bottom-5 -left-10 text-red-600"
              >
                <Flame className="w-16 h-16 animate-pulse" />
              </motion.div>
            </motion.div>
            
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="mt-6 text-xl font-bold tracking-widest text-orange-200 uppercase bg-black/50 px-6 py-2 rounded-full border border-orange-500/30 backdrop-blur-md"
            >
              Cortes Forjados com Sucesso
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
