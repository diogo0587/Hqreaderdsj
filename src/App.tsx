/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  Languages, 
  Loader2, 
  Trash2, 
  BookOpen, 
  Maximize2, 
  Minimize2, 
  Camera, 
  X,
  Upload,
  Settings,
  Eye,
  EyeOff,
  Moon,
  Sun
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Initialize Gemini API
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

interface TranslationResult {
  panels: {
    originalText: string;
    translatedText: string;
    description: string;
    boundingBox: [number, number, number, number]; // [ymin, xmin, ymax, xmax]
  }[];
}

export default function App() {
  const [isOpen, setIsOpen] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showOverlay, setShowOverlay] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark') || 
             window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    // Detect if running inside an iframe
    setIsInIframe(window.self !== window.top);
  }, []);

  const openInNewTab = () => {
    window.open(window.location.href, '_blank');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setResult(null);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const captureScreen = async () => {
    try {
      // Check if the API exists
      const mediaDevices = navigator.mediaDevices;
      if (!mediaDevices || (typeof mediaDevices.getDisplayMedia !== 'function' && typeof (navigator as any).getDisplayMedia !== 'function')) {
        throw new Error("API de captura não suportada neste navegador ou contexto (tente abrir em uma nova aba).");
      }

      const getDisplayMedia = mediaDevices.getDisplayMedia?.bind(mediaDevices) || (navigator as any).getDisplayMedia?.bind(navigator);

      const stream = await getDisplayMedia({
        video: { cursor: "always" } as any,
        audio: false
      });
      
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();

      video.onloadedmetadata = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        
        // Wait a bit for the stream to stabilize
        setTimeout(() => {
          ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg');
          setImage(dataUrl);
          setResult(null);
          setError(null);
          
          // Stop all tracks
          stream.getTracks().forEach(track => track.stop());
          video.remove();
        }, 500);
      };
    } catch (err: any) {
      console.error("Erro ao capturar tela:", err);
      if (err.name === 'NotAllowedError') {
        setError("Permissão negada para capturar a tela.");
      } else if (err.message.includes("not a function") || err.message.includes("suportada")) {
        setError("A captura de tela é bloqueada em iFrames por segurança. Clique no botão abaixo para abrir em uma NOVA ABA.");
      } else {
        setError("Erro ao capturar tela. Tente fazer o upload manual.");
      }
    }
  };

  const translateComic = async () => {
    if (!image) return;

    setIsProcessing(true);
    setError(null);

    try {
      const base64Data = image.split(',')[1];
      const model = "gemini-3-flash-preview";
      
      const prompt = `
        Analise esta imagem (pode ser uma página de HQ ou um site). 
        1. Identifique todos os blocos de texto, balões de fala ou legendas.
        2. Extraia o texto original.
        3. Traduza cada texto para o Português Brasileiro, mantendo o contexto.
        4. Forneça as coordenadas exatas da caixa de texto no formato [ymin, xmin, ymax, xmax] em escala de 0 a 1000.
        
        Retorne o resultado estritamente no formato JSON:
        {
          "panels": [
            {
              "originalText": "texto original",
              "translatedText": "texto traduzido",
              "description": "contexto curto",
              "boundingBox": [ymin, xmin, ymax, xmax]
            }
          ]
        }
      `;

      const response = await genAI.models.generateContent({
        model: model,
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: "image/jpeg",
                  data: base64Data
                }
              }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json"
        }
      });

      const text = response.text;
      if (text) {
        const parsedResult = JSON.parse(text) as TranslationResult;
        setResult(parsedResult);
      }
    } catch (err) {
      console.error("Erro na tradução:", err);
      setError("Erro ao processar. Tente novamente.");
    } finally {
      setIsProcessing(false);
    }
  };

  const clearAll = () => {
    setImage(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-50 flex items-end justify-end p-6">
      {/* Background Dimmer when open */}
      <AnimatePresence>
        {isOpen && !isMinimized && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm pointer-events-auto"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Main Bubble / Window */}
      <div className="relative pointer-events-auto">
        <AnimatePresence>
          {!isOpen ? (
            /* Floating Bubble */
            <motion.button
              layoutId="bubble"
              initial={{ scale: 0, rotate: -45 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 45 }}
              onClick={() => setIsOpen(true)}
              className="w-16 h-16 bg-emerald-600 rounded-full shadow-2xl flex items-center justify-center text-white hover:bg-emerald-700 transition-colors group relative"
            >
              <Languages className="w-8 h-8 group-hover:scale-110 transition-transform" />
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-pulse" />
            </motion.button>
          ) : (
            /* Expanded Window */
            <motion.div
              layoutId="bubble"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={`bg-white dark:bg-stone-900 rounded-[2rem] shadow-2xl border border-stone-200 dark:border-stone-700 overflow-hidden flex flex-col transition-all duration-300 ${
                isMinimized ? 'w-72 h-16' : 'w-[90vw] max-w-4xl h-[85vh]'
              }`}
            >
              {/* Header */}
              <div className="h-16 px-6 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between bg-stone-50/50 dark:bg-stone-800/50">
                <div className="flex items-center gap-3">
                  <div className="bg-emerald-600 p-1.5 rounded-lg">
                    <BookOpen className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-bold text-stone-800 dark:text-stone-100">HQ Bubble Translator</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    className="p-2 hover:bg-stone-200 dark:hover:bg-stone-700 rounded-full transition-colors text-stone-500 dark:text-stone-400"
                  >
                    {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  </button>
                  <button 
                    onClick={() => setIsMinimized(!isMinimized)}
                    className="p-2 hover:bg-stone-200 dark:hover:bg-stone-700 rounded-full transition-colors text-stone-500 dark:text-stone-400"
                  >
                    {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                  </button>
                  <button 
                    onClick={() => setIsOpen(false)}
                    className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 rounded-full transition-colors text-stone-500 dark:text-stone-400"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {!isMinimized && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Iframe Warning Banner */}
                  {isInIframe && (
                    <div className="bg-amber-50 dark:bg-amber-900/30 border-b border-amber-100 dark:border-amber-800 px-4 py-2 flex items-center justify-between gap-4">
                      <p className="text-[10px] text-amber-700 dark:text-amber-400 font-bold uppercase tracking-wider leading-tight">
                        Modo Preview: A captura de tela exige uma nova aba.
                      </p>
                      <button 
                        onClick={openInNewTab}
                        className="text-[10px] bg-amber-600 dark:bg-amber-500 text-white px-2 py-1 rounded font-bold hover:bg-amber-700 dark:hover:bg-amber-600 transition-colors whitespace-nowrap"
                      >
                        ABRIR AGORA
                      </button>
                    </div>
                  )}

                  {/* Toolbar */}
                  <div className="p-4 border-b border-stone-100 dark:border-stone-800 flex items-center gap-3 bg-white dark:bg-stone-900">
                    <button 
                      onClick={isInIframe ? openInNewTab : captureScreen}
                      className={`flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 ${
                        isInIframe ? 'bg-amber-600 dark:bg-amber-500 text-white hover:bg-amber-700 dark:hover:bg-amber-600' : 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-white'
                      }`}
                    >
                      <Camera className="w-4 h-4" />
                      {isInIframe ? 'Liberar Captura' : 'Capturar Tela'}
                    </button>
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 py-2.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-stone-50 dark:hover:bg-stone-700 transition-all active:scale-95"
                    >
                      <Upload className="w-4 h-4" />
                      Upload
                    </button>
                    {image && !result && !isProcessing && (
                      <button 
                        onClick={translateComic}
                        className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all animate-bounce"
                      >
                        <Languages className="w-4 h-4" />
                        Traduzir
                      </button>
                    )}
                    {result && (
                      <button 
                        onClick={() => setShowOverlay(!showOverlay)}
                        className={`p-2.5 rounded-xl transition-all ${showOverlay ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400' : 'bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400'}`}
                        title="Toggle Overlay"
                      >
                        {showOverlay ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                      </button>
                    )}
                    {image && (
                      <button 
                        onClick={clearAll}
                        className="p-2.5 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/50 transition-all"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>

                  {/* Content Area */}
                  <div className="flex-1 overflow-hidden relative bg-stone-100 dark:bg-stone-950 flex items-center justify-center">
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleImageUpload} 
                      accept="image/*" 
                      className="hidden" 
                    />

                    {!image && !isProcessing && (
                      <div className="text-center space-y-4 max-w-xs">
                        <div className="w-20 h-20 bg-white dark:bg-stone-800 rounded-3xl shadow-sm flex items-center justify-center mx-auto">
                          <Languages className="w-10 h-10 text-emerald-600 dark:text-emerald-500" />
                        </div>
                        <h3 className="text-lg font-bold text-stone-800 dark:text-stone-100">Pronto para traduzir</h3>
                        <p className="text-sm text-stone-500 dark:text-stone-400">Capture qualquer site ou faça upload de uma imagem para ver a mágica acontecer.</p>
                      </div>
                    )}

                    {isProcessing && (
                      <div className="absolute inset-0 bg-white/80 dark:bg-stone-900/80 backdrop-blur-sm z-30 flex flex-col items-center justify-center gap-4">
                        <Loader2 className="w-12 h-12 animate-spin text-emerald-600 dark:text-emerald-500" />
                        <p className="font-bold text-emerald-800 dark:text-emerald-400 animate-pulse">Traduzindo conteúdo...</p>
                      </div>
                    )}

                    {image && (
                      <div className="relative w-full h-full flex items-center justify-center p-4 overflow-auto custom-scrollbar">
                        <div className="relative inline-block shadow-2xl rounded-lg overflow-hidden bg-white dark:bg-stone-800">
                          <img src={image} alt="Capture" className="max-w-none h-auto block" style={{ maxHeight: 'calc(85vh - 150px)' }} />
                          
                          {result && showOverlay && (
                            <div className="absolute inset-0 pointer-events-none">
                              {result.panels.map((panel, idx) => {
                                const [ymin, xmin, ymax, xmax] = panel.boundingBox;
                                return (
                                  <motion.div 
                                    key={idx}
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="absolute bg-white/95 dark:bg-stone-800/95 flex items-center justify-center text-center p-1 leading-tight overflow-hidden border border-emerald-500/30 dark:border-emerald-500/50"
                                    style={{
                                      top: `${ymin / 10}%`,
                                      left: `${xmin / 10}%`,
                                      width: `${(xmax - xmin) / 10}%`,
                                      height: `${(ymax - ymin) / 10}%`,
                                      fontSize: 'clamp(8px, 1vw, 14px)',
                                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                      borderRadius: '4px',
                                      zIndex: 10
                                    }}
                                  >
                                    <span className="text-black dark:text-white font-bold leading-tight" style={{ fontFamily: '"Comic Neue", "Comic Sans MS", cursive, sans-serif' }}>
                                      {panel.translatedText}
                                    </span>
                                  </motion.div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {error && (
                      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-red-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex flex-col items-center gap-3 z-40 max-w-sm text-center">
                        <div className="flex items-center gap-2">
                          <X className="w-5 h-5" />
                          <span className="font-bold">Atenção</span>
                        </div>
                        <p className="text-xs opacity-90 leading-relaxed">{error}</p>
                        {error.includes("NOVA ABA") && (
                          <button 
                            onClick={openInNewTab}
                            className="mt-2 px-4 py-2 bg-white text-red-600 rounded-xl font-bold text-xs hover:bg-stone-100 transition-colors flex items-center gap-2"
                          >
                            <Maximize2 className="w-4 h-4" />
                            ABRIR EM NOVA ABA AGORA
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Footer Stats */}
                  {result && (
                    <div className="h-10 px-6 bg-stone-50 border-t border-stone-100 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-stone-400">
                      <span>{result.panels.length} Blocos Traduzidos</span>
                      <span className="text-emerald-600">Tradução Ativa</span>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #F5F5F4;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #D6D3D1;
          border-radius: 10px;
          border: 2px solid #F5F5F4;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #A8A29E;
        }
      `}} />
    </div>
  );
}
