import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import * as mammoth from 'mammoth';
import { UploadCloud, FileText, CheckCircle, XCircle, RefreshCw, ChevronRight, Award, Trash2, Clock, Sun, Moon, Server, Cloud, Settings } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import * as pdfjsLib from 'pdfjs-dist';
import { cn } from './lib/utils';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface Question {
  context?: string;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation?: string;
}

interface SavedQuiz {
  id: string;
  title: string;
  date: string;
  questions: Question[];
}

type AppState = 'UPLOAD' | 'PROCESSING' | 'QUIZ' | 'RESULTS';

export default function App() {
  const [appState, setAppState] = useState<AppState>('UPLOAD');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [savedQuizzes, setSavedQuizzes] = useState<SavedQuiz[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswerIndex, setSelectedAnswerIndex] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [llmMode, setLlmMode] = useState<'api' | 'local'>('api');
  const [localLlmUrl, setLocalLlmUrl] = useState('http://localhost:11434/v1/chat/completions');
  const [showSettings, setShowSettings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loaded = localStorage.getItem('qcm_saved_quizzes');
    if (loaded) {
      try {
        setSavedQuizzes(JSON.parse(loaded));
      } catch (e) {
        console.error("Failed to parse saved quizzes", e);
      }
    }

    const savedTheme = localStorage.getItem('qcm_theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      if (savedTheme === 'dark') document.documentElement.classList.add('dark');
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
      document.documentElement.classList.add('dark');
    }
    
    const savedLlmMode = localStorage.getItem('qcm_llm_mode') as 'api' | 'local' | null;
    if (savedLlmMode) setLlmMode(savedLlmMode);
    
    const savedLocalUrl = localStorage.getItem('qcm_local_url');
    if (savedLocalUrl) setLocalLlmUrl(savedLocalUrl);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('qcm_theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const saveLlmSettings = (mode: 'api' | 'local', url: string) => {
    setLlmMode(mode);
    setLocalLlmUrl(url);
    localStorage.setItem('qcm_llm_mode', mode);
    localStorage.setItem('qcm_local_url', url);
  };

  const saveQuiz = (title: string, extractedQuestions: Question[]) => {
    const newQuiz: SavedQuiz = {
      id: Date.now().toString(),
      title,
      date: new Date().toLocaleDateString(),
      questions: extractedQuestions
    };
    const updatedQuizzes = [newQuiz, ...savedQuizzes];
    setSavedQuizzes(updatedQuizzes);
    localStorage.setItem('qcm_saved_quizzes', JSON.stringify(updatedQuizzes));
  };

  const deleteQuiz = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedQuizzes = savedQuizzes.filter(q => q.id !== id);
    setSavedQuizzes(updatedQuizzes);
    localStorage.setItem('qcm_saved_quizzes', JSON.stringify(updatedQuizzes));
  };

  const loadQuiz = (quiz: SavedQuiz) => {
    setQuestions(quiz.questions);
    setCurrentQuestionIndex(0);
    setScore(0);
    setSelectedAnswerIndex(null);
    setAppState('QUIZ');
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setAppState('PROCESSING');
    setError(null);

    try {
      let extractedQuestions: Question[] = [];
      const extractionPrompt = "Extract all the multiple choice questions from this document. If a question refers to a specific text, statement, or data table, extract that information and put it in the 'context' field. IMPORTANT: If the context contains a data table, you MUST format it strictly as a Markdown table. Ensure you capture the question, exactly 4 options, the correct answer index (0-3), and any explanation provided.";

      if (llmMode === 'api') {
        let promptContents: any;
        if (file.type === 'application/pdf') {
          const base64Data = await readFileAsBase64(file);
          promptContents = [
            {
              inlineData: {
                data: base64Data.split(',')[1],
                mimeType: 'application/pdf',
              },
            },
            extractionPrompt
          ];
        } else if (file.name.endsWith('.docx')) {
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          const text = result.value;
          promptContents = `${extractionPrompt}\n\nText:\n${text}`;
        } else if (file.type === 'text/plain') {
          const text = await file.text();
          promptContents = `${extractionPrompt}\n\nText:\n${text}`;
        } else {
          throw new Error('Unsupported file format. Please upload a PDF, DOCX, or TXT file.');
        }

        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: promptContents,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  context: {
                    type: Type.STRING,
                    description: "The general statement, context, or data table that precedes and applies to the question. Format data tables strictly as Markdown tables. Leave empty if not applicable."
                  },
                  question: {
                    type: Type.STRING,
                    description: "The text of the multiple choice question."
                  },
                  options: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.STRING
                    },
                    description: "Exactly 4 possible answers for the question."
                  },
                  correctAnswerIndex: {
                    type: Type.INTEGER,
                    description: "The index (0, 1, 2, or 3) of the correct answer in the options array."
                  },
                  explanation: {
                    type: Type.STRING,
                    description: "A brief explanation of why the answer is correct, if available in the text."
                  }
                },
                required: ["question", "options", "correctAnswerIndex"]
              }
            }
          }
        });

        extractedQuestions = JSON.parse(response.text || '[]');
      } else {
        // Local LLM Mode
        let text = '';
        if (file.type === 'application/pdf') {
          text = await extractTextFromPdf(file);
        } else if (file.name.endsWith('.docx')) {
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          text = result.value;
        } else if (file.type === 'text/plain') {
          text = await file.text();
        } else {
          throw new Error('Unsupported file format. Please upload a PDF, DOCX, or TXT file.');
        }

        const promptText = `${extractionPrompt}\n\nFormat your response as a JSON array of objects, where each object has the following keys: "context" (string, optional), "question" (string), "options" (array of exactly 4 strings), "correctAnswerIndex" (integer 0-3), and "explanation" (string, optional).\n\nText:\n${text}`;

        const response = await fetch(localLlmUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama3', // Default model name, often ignored or required depending on the local server
            messages: [
              { role: 'system', content: 'You are a helpful assistant that extracts multiple choice questions and outputs ONLY valid JSON.' },
              { role: 'user', content: promptText }
            ],
            response_format: { type: "json_object" },
            temperature: 0.1
          })
        });

        if (!response.ok) {
          throw new Error(`Local LLM request failed: ${response.statusText}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || data.response || data.message?.content;
        
        if (!content) {
          throw new Error('Invalid response format from local LLM.');
        }

        try {
          const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
          const jsonString = jsonMatch ? jsonMatch[1] : content;
          let parsedData: any = JSON.parse(jsonString);
          
          if (!Array.isArray(parsedData)) {
            if (parsedData.questions && Array.isArray(parsedData.questions)) {
              parsedData = parsedData.questions;
            } else {
              parsedData = [parsedData];
            }
          }
          extractedQuestions = parsedData;
        } catch (e) {
          console.error("Failed to parse JSON from local LLM:", content);
          throw new Error('Failed to parse the JSON response from the local LLM.');
        }
      }
      
      if (extractedQuestions.length === 0) {
        throw new Error('No questions could be extracted from the document.');
      }

      saveQuiz(file.name, extractedQuestions);
      setQuestions(extractedQuestions);
      setCurrentQuestionIndex(0);
      setScore(0);
      setSelectedAnswerIndex(null);
      setAppState('QUIZ');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred while processing the file.');
      setAppState('UPLOAD');
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const extractTextFromPdf = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((item: any) => item.str).join(' ') + '\n';
    }
    return text;
  };

  const handleAnswerSelect = (index: number) => {
    if (selectedAnswerIndex !== null) return; // Prevent changing answer
    
    setSelectedAnswerIndex(index);
    if (index === questions[currentQuestionIndex].correctAnswerIndex) {
      setScore(prev => prev + 1);
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswerIndex(null);
    } else {
      setAppState('RESULTS');
    }
  };

  const resetApp = () => {
    setAppState('UPLOAD');
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setSelectedAnswerIndex(null);
    setScore(0);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-indigo-100 dark:selection:bg-indigo-900/50 selection:text-indigo-900 dark:selection:text-indigo-100 transition-colors">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 transition-colors">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={resetApp}>
            <div className="bg-indigo-600 p-2 rounded-lg text-white">
              <FileText className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">QCM Reader</h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-full transition-colors"
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={toggleTheme}
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-full transition-colors"
              title="Toggle Theme"
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
            {appState === 'QUIZ' && (
              <div className="flex items-center gap-3">
                <div className="text-sm font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full hidden sm:block">
                  Question {currentQuestionIndex + 1} of {questions.length}
                </div>
                <button 
                  onClick={resetApp}
                  className="text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5"
                  title="Quit Quiz"
                >
                  <XCircle className="w-4 h-4" />
                  <span className="hidden sm:inline">Quitter</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {showSettings && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h2>
                <button
                  onClick={() => setShowSettings(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full transition-colors"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-slate-900 dark:text-white mb-3">LLM Mode</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => saveLlmSettings('api', localLlmUrl)}
                      className={cn(
                        "flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all",
                        llmMode === 'api' 
                          ? "border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300" 
                          : "border-slate-200 hover:border-indigo-300 text-slate-600 dark:border-slate-700 dark:text-slate-400"
                      )}
                    >
                      <Cloud className="w-5 h-5" />
                      <span className="font-medium">Gemini API</span>
                    </button>
                    <button
                      onClick={() => saveLlmSettings('local', localLlmUrl)}
                      className={cn(
                        "flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all",
                        llmMode === 'local' 
                          ? "border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300" 
                          : "border-slate-200 hover:border-indigo-300 text-slate-600 dark:border-slate-700 dark:text-slate-400"
                      )}
                    >
                      <Server className="w-5 h-5" />
                      <span className="font-medium">Local LLM</span>
                    </button>
                  </div>
                </div>

                {llmMode === 'local' && (
                  <div>
                    <label htmlFor="localUrl" className="block text-sm font-medium text-slate-900 dark:text-white mb-2">
                      Local LLM URL (OpenAI Compatible)
                    </label>
                    <input
                      type="text"
                      id="localUrl"
                      value={localLlmUrl}
                      onChange={(e) => saveLlmSettings('local', e.target.value)}
                      className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      placeholder="http://localhost:11434/v1/chat/completions"
                    />
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      Ensure your local LLM server is running and supports CORS. For Ollama, use the v1/chat/completions endpoint.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-800">
            <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold">Error processing file</h3>
              <p className="text-sm mt-1 opacity-90">{error}</p>
            </div>
          </div>
        )}

        {appState === 'UPLOAD' && (
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl mb-4">
                Turn your documents into interactive quizzes
              </h2>
              <p className="text-lg text-slate-600 dark:text-slate-400">
                Upload a PDF, Word document, or text file containing multiple-choice questions and their answers. We'll extract them and create a quiz for you.
              </p>
            </div>

            <label
              htmlFor="file-upload"
              className="relative block w-full border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-3xl p-12 text-center hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 transition-colors cursor-pointer group bg-white dark:bg-slate-900"
            >
              <input
                id="file-upload"
                type="file"
                accept=".pdf,.docx,.txt"
                className="sr-only"
                onChange={handleFileUpload}
                ref={fileInputRef}
              />
              <div className="mx-auto w-16 h-16 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <UploadCloud className="w-8 h-8" />
              </div>
              <span className="block text-lg font-semibold text-slate-900 dark:text-white mb-1">
                Click to upload a document
              </span>
              <span className="block text-sm text-slate-500 dark:text-slate-400">
                Supports PDF, DOCX, and TXT files
              </span>
            </label>

            {savedQuizzes.length > 0 && (
              <div className="mt-12">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                  <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200">Recent Quizzes</h3>
                </div>
                <div className="space-y-3">
                  {savedQuizzes.map(quiz => (
                    <div 
                      key={quiz.id} 
                      onClick={() => loadQuiz(quiz)}
                      className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:shadow-sm transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-xl text-slate-500 dark:text-slate-400 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/30 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          <FileText className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-slate-900 dark:text-white">{quiz.title}</h4>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                            {quiz.questions.length} questions • {quiz.date}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={(e) => deleteQuiz(quiz.id, e)}
                          className="p-2 text-slate-400 dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"
                          title="Delete quiz"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                        <ChevronRight className="w-5 h-5 text-slate-400 dark:text-slate-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {appState === 'PROCESSING' && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="relative w-20 h-20 mb-8">
              <div className="absolute inset-0 border-4 border-indigo-100 dark:border-indigo-900/30 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-indigo-600 dark:border-indigo-500 rounded-full border-t-transparent animate-spin"></div>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Analyzing Document</h2>
            <p className="text-slate-500 dark:text-slate-400 text-center max-w-md">
              Our AI is reading your file, extracting the questions, context, options, and correct answers to build your quiz...
            </p>
          </div>
        )}

        {appState === 'QUIZ' && questions.length > 0 && (
          <div className="max-w-3xl mx-auto">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="p-8 sm:p-10">
                
                {questions[currentQuestionIndex].context && (
                  <div className="mb-8 p-6 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">Énoncé / Contexte</h4>
                    <div className="text-slate-700 dark:text-slate-300 font-medium leading-relaxed overflow-x-auto">
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={{
                          table: ({node, ...props}) => <table className="min-w-full divide-y divide-slate-300 dark:divide-slate-700 border border-slate-200 dark:border-slate-700 my-4 bg-white dark:bg-slate-800 rounded-lg" {...props} />,
                          thead: ({node, ...props}) => <thead className="bg-slate-200 dark:bg-slate-700" {...props} />,
                          th: ({node, ...props}) => <th className="px-4 py-2 text-left text-sm font-bold text-slate-900 dark:text-white border-x border-slate-200 dark:border-slate-700" {...props} />,
                          td: ({node, ...props}) => <td className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300 border-x border-slate-200 dark:border-slate-700" {...props} />,
                          tr: ({node, ...props}) => <tr className="border-b border-slate-200 dark:border-slate-700 last:border-0" {...props} />,
                          p: ({node, ...props}) => <p className="mb-2 last:mb-0 whitespace-pre-wrap" {...props} />
                        }}
                      >
                        {questions[currentQuestionIndex].context}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}

                <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-white leading-tight mb-8">
                  {questions[currentQuestionIndex].question}
                </h2>

                <div className="space-y-3">
                  {questions[currentQuestionIndex].options.map((option, index) => {
                    const isSelected = selectedAnswerIndex === index;
                    const isCorrect = index === questions[currentQuestionIndex].correctAnswerIndex;
                    const showResults = selectedAnswerIndex !== null;
                    
                    let buttonClass = "w-full text-left p-5 rounded-2xl border-2 transition-all duration-200 flex items-center justify-between group ";
                    
                    if (!showResults) {
                      buttonClass += "border-slate-200 dark:border-slate-700 hover:border-indigo-600 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-slate-700 dark:text-slate-300 hover:text-indigo-900 dark:hover:text-indigo-300 bg-white dark:bg-slate-800";
                    } else {
                      if (isCorrect) {
                        buttonClass += "border-emerald-500 dark:border-emerald-500/50 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-900 dark:text-emerald-300";
                      } else if (isSelected && !isCorrect) {
                        buttonClass += "border-rose-500 dark:border-rose-500/50 bg-rose-50 dark:bg-rose-900/20 text-rose-900 dark:text-rose-300";
                      } else {
                        buttonClass += "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 opacity-60";
                      }
                    }

                    return (
                      <button
                        key={index}
                        onClick={() => handleAnswerSelect(index)}
                        disabled={showResults}
                        className={buttonClass}
                      >
                        <span className="text-lg font-medium pr-4">{option}</span>
                        {showResults && isCorrect && <CheckCircle className="w-6 h-6 text-emerald-500 dark:text-emerald-400 shrink-0" />}
                        {showResults && isSelected && !isCorrect && <XCircle className="w-6 h-6 text-rose-500 dark:text-rose-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>

                {selectedAnswerIndex !== null && (
                  <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {questions[currentQuestionIndex].explanation && (
                      <div className="mb-6 p-5 bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-300 rounded-2xl border border-blue-100 dark:border-blue-800/50">
                        <h4 className="font-semibold mb-2 flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          Explanation
                        </h4>
                        <p className="text-blue-800/80 dark:text-blue-300/80 leading-relaxed">
                          {questions[currentQuestionIndex].explanation}
                        </p>
                      </div>
                    )}
                    
                    <div className="flex justify-end">
                      <button
                        onClick={handleNextQuestion}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-full font-semibold text-lg transition-transform hover:scale-105 active:scale-95"
                      >
                        {currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'See Results'}
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {appState === 'RESULTS' && (
          <div className="max-w-2xl mx-auto text-center py-12">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-full mb-8">
              <Award className="w-12 h-12" />
            </div>
            <h2 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">Quiz Completed!</h2>
            <p className="text-xl text-slate-600 dark:text-slate-400 mb-10">
              You scored <span className="font-bold text-indigo-600 dark:text-indigo-400">{score}</span> out of <span className="font-bold text-slate-900 dark:text-white">{questions.length}</span>
            </p>
            
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-4 mb-12 overflow-hidden">
              <div 
                className="bg-indigo-600 dark:bg-indigo-500 h-4 rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${(score / questions.length) * 100}%` }}
              ></div>
            </div>

            <button
              onClick={resetApp}
              className="inline-flex items-center gap-2 bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-700 text-white px-8 py-4 rounded-full font-semibold text-lg transition-transform hover:scale-105 active:scale-95"
            >
              <RefreshCw className="w-5 h-5" />
              Back to Home
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
