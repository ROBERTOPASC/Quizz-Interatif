import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import * as mammoth from 'mammoth';
import { get, set } from 'idb-keyval';
import { UploadCloud, FileText, CheckCircle, XCircle, X, RefreshCw, ChevronRight, ChevronLeft, Award, Trash2, Clock, Sun, Moon, Server, Cloud, Settings, BookOpen, Calculator, Globe, Monitor, Layers, Eye, EyeOff, Key, BookOpenCheck, RotateCcw, BrainCircuit, Search, Sparkles, ListChecks, Hash, Calendar, ShieldCheck, Download, Share2, Building2, Folder, FolderPlus, FolderOpen, ChevronDown, FolderTree, Tag, Filter, FolderKanban, Edit3, CornerDownRight, FolderInput, FolderCheck, Home, Zap, Brain, Database, HardDrive, Save, Check, RotateCw, Layers3, FileSpreadsheet, LayoutGrid, List, Star } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import * as pdfjsLib from 'pdfjs-dist';
import { cn } from './lib/utils';
import {
  FACT_SHEET_TOPICS,
  EU_SUBTYPES,
  FACT_SHEET_SKILLS,
  QCM_SKILLS,
  DOCUMENT_ANALYSIS_SKILL,
  FLASHCARD_SKILL,
  ESSAY_SKILL
} from './skills';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface DocumentFolder {
  id: string;
  name: string;
  parentId?: string | null;
  createdAt: number;
  color?: string;
}

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
  category?: string;
  subType?: string;
  docName?: string;
  folderId?: string;
  folderName?: string;
}

interface SavedFactSheet {
  id: string;
  title: string;
  concepts: FactSheetConcept[];
  createdAt: number;
  category?: string;
  docName?: string;
  folderId?: string;
  folderName?: string;
}

interface SavedFlashcardDeck {
  id: string;
  title: string;
  cards: Flashcard[];
  createdAt: number;
  category?: string;
  docName?: string;
  folderId?: string;
  folderName?: string;
}

interface Flashcard {
  front: string;
  back: string;
}

interface FactSheetConcept {
  term: string;
  definition: string;
  date?: string;
  explanation: string;
  example: string;
}

export interface ExtractedNotion {
  id: string;
  title: string;
  category: string;
  summary: string;
  keyPoints: string[];
  sourcePage?: string;
}

export interface DocumentModule {
  moduleNumber: number;
  title: string;
  description: string;
  notions: ExtractedNotion[];
}

interface DocumentAnalysisResult {
  id: string;
  docName: string;
  pageRange?: string;
  summary: string;
  modules?: DocumentModule[];
  notions?: ExtractedNotion[];
  keyFigures: Array<{ figure: string; context: string }>;
  entities: Array<{ name: string; role: string }>;
  takeaways: string[];
  vocabulary: Array<{ term: string; definition: string }>;
  timeline: Array<{ date: string; event: string }>;
  createdAt: number;
  seed: number;
  folderId?: string;
  folderName?: string;
}

type AppState = 'UPLOAD' | 'PROCESSING' | 'QUIZ' | 'RESULTS' | 'ESSAY_WRITING' | 'ESSAY_RESULTS' | 'FACT_SHEET' | 'FLASHCARDS' | 'DOCUMENT_VIEWER' | 'DOCUMENT_ANALYSIS';

export default function App() {
  const [appState, setAppState] = useState<AppState>('UPLOAD');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [savedQuizzes, setSavedQuizzes] = useState<SavedQuiz[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswerIndex, setSelectedAnswerIndex] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [userAnswers, setUserAnswers] = useState<number[]>([]);
  const [showReview, setShowReview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [llmMode, setLlmMode] = useState<'api' | 'local'>('api');
  const [localLlmUrl, setLocalLlmUrl] = useState('http://localhost:11434/v1/chat/completions');
  const [userApiKey, setUserApiKey] = useState(() => localStorage.getItem('qcm_user_api_key') || '');
  const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem('qcm_selected_model') || 'gemini-2.5-flash');
  const [modelCategoryTab, setModelCategoryTab] = useState<'flash' | 'pro'>(() => {
    const cur = localStorage.getItem('qcm_selected_model') || 'gemini-2.5-flash';
    return cur.includes('pro') ? 'pro' : 'flash';
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [customModelInput, setCustomModelInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [isDbArchitectureModalOpen, setIsDbArchitectureModalOpen] = useState(false);
  const [dbStorageEstimate, setDbStorageEstimate] = useState<{ usageMB: string, quotaGB: string, percentUsed: string } | null>(null);
  const [currentSeed, setCurrentSeed] = useState<number>(() => Math.floor(Math.random() * 900000) + 100000);

  const refreshStorageEstimate = async () => {
    if (navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        const usageMB = estimate.usage ? (estimate.usage / (1024 * 1024)).toFixed(2) : '0';
        const quotaGB = estimate.quota ? (estimate.quota / (1024 * 1024 * 1024)).toFixed(2) : '0';
        const percentUsed = estimate.usage && estimate.quota ? ((estimate.usage / estimate.quota) * 100).toFixed(1) : '0';
        setDbStorageEstimate({ usageMB, quotaGB, percentUsed });
      } catch (e) {
        console.error("Storage estimate error", e);
      }
    }
  };

  const handleExportDatabase = () => {
    const exportData = {
      app: "Prepa EPSO AD5 Database",
      version: "2.0",
      exportedAt: new Date().toISOString(),
      stats: {
        documentsCount: libraryDocuments.length,
        quizzesCount: savedQuizzes.length,
        factSheetsCount: savedFactSheets.length,
        flashcardsCount: savedFlashcards.length,
        docAnalysesCount: savedDocAnalyses.length,
        foldersCount: libraryFolders.length,
      },
      data: {
        libraryDocuments: libraryDocuments.map(d => ({ ...d, url: '' })),
        libraryFolders,
        savedQuizzes,
        savedFactSheets,
        savedFlashcards,
        savedDocAnalyses,
      }
    };

    const jsonBlob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const downloadUrl = URL.createObjectURL(jsonBlob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `epso_ad5_db_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);
    setLibraryNotification("📥 Base de données exportée avec succès ! (Sauvegarde JSON complète)");
  };

  const handleImportDatabase = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (json && json.data) {
          if (Array.isArray(json.data.libraryDocuments)) {
            setLibraryDocuments(json.data.libraryDocuments);
            await set('libraryDocuments', json.data.libraryDocuments.map((d: any) => ({ ...d, url: '' })));
          }
          if (Array.isArray(json.data.libraryFolders)) {
            setLibraryFolders(json.data.libraryFolders);
            await set('libraryFolders', json.data.libraryFolders);
          }
          if (Array.isArray(json.data.savedQuizzes)) {
            setSavedQuizzes(json.data.savedQuizzes);
            await set('savedQuizzes', json.data.savedQuizzes);
          }
          if (Array.isArray(json.data.savedFactSheets)) {
            setSavedFactSheets(json.data.savedFactSheets);
            await set('savedFactSheets', json.data.savedFactSheets);
          }
          if (Array.isArray(json.data.savedFlashcards)) {
            setSavedFlashcards(json.data.savedFlashcards);
            await set('savedFlashcards', json.data.savedFlashcards);
          }
          if (Array.isArray(json.data.savedDocAnalyses)) {
            setSavedDocAnalyses(json.data.savedDocAnalyses);
            await set('savedDocAnalyses', json.data.savedDocAnalyses);
          }
          setLibraryNotification("✅ Base de données restaurée et fusionnée avec succès !");
          refreshStorageEstimate();
        } else {
          alert("Fichier de sauvegarde non valide.");
        }
      } catch (err) {
        console.error("Erreur lors de la restauration DB", err);
        alert("Erreur lors de la lecture du fichier JSON de sauvegarde.");
      }
    };
    reader.readAsText(file);
  };
  
  const [uploadedDocument, setUploadedDocument] = useState<{file: File, url: string, numPages: number, type: string, folderId?: string | null} | null>(null);
  const [pdfPageRange, setPdfPageRange] = useState<{start: number, end: number}>({start: 1, end: 1});
  const [chunkMode, setChunkMode] = useState<'manual' | 'auto5' | 'auto20'>('manual');
  const [processingProgress, setProcessingProgress] = useState<{current: number, total: number} | null>(null);
  const [libraryDocuments, setLibraryDocuments] = useState<Array<{id: string, name: string, file: File, url: string, numPages: number, type: string, addedAt: number, folderId?: string | null}>>([]);
  const [libraryFolders, setLibraryFolders] = useState<DocumentFolder[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null); // null = Racine / Tous
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null);
  const [newFolderColor, setNewFolderColor] = useState('indigo');
  const [editingFolder, setEditingFolder] = useState<DocumentFolder | null>(null);
  const [selectedDocIdsForMove, setSelectedDocIdsForMove] = useState<string[]>([]);
  const [moveModalDocIds, setMoveModalDocIds] = useState<string[] | null>(null);
  const [moveModalResource, setMoveModalResource] = useState<{ type: 'quiz' | 'analysis' | 'fact_sheet' | 'flashcard', id: string, title: string } | null>(null);
  const [draggedDocId, setDraggedDocId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null | 'root'>(null);
  const [libraryNotification, setLibraryNotification] = useState<string | null>(null);

  const [savedFactSheets, setSavedFactSheets] = useState<Array<{id: string, title: string, content?: string, concepts?: FactSheetConcept[], createdAt: number, docName?: string, folderId?: string, folderName?: string, topic?: string}>>([]);
  const [savedFlashcards, setSavedFlashcards] = useState<Array<{id: string, title: string, cards: Flashcard[], createdAt: number, docName?: string, folderId?: string, folderName?: string}>>([]);
  const [savedDocAnalyses, setSavedDocAnalyses] = useState<DocumentAnalysisResult[]>([]);
  const [docAnalysisResult, setDocAnalysisResult] = useState<DocumentAnalysisResult | null>(null);
  const [librarySearchQuery, setLibrarySearchQuery] = useState('');
  const [librarySection, setLibrarySection] = useState<'documents' | 'generated'>('documents');
  const [generatedFilter, setGeneratedFilter] = useState<'all' | 'quizzes' | 'analyses' | 'fact_sheets' | 'flashcards'>('all');
  const [viewingQuizModal, setViewingQuizModal] = useState<SavedQuiz | null>(null);
  const [docProcessingType, setDocProcessingType] = useState<'qcm' | 'fact_sheet_general' | 'fact_sheet_institutions' | 'fact_sheet_history' | 'fact_sheet_policies' | 'vocab' | 'english' | 'document_analysis'>('document_analysis');

  // Filtering generated fact sheets and flashcards
  const [generatedFolderFilter, setGeneratedFolderFilter] = useState<string>('all');
  const [generatedTopicFilter, setGeneratedTopicFilter] = useState<string>('all');

  // Flexible Source Selection States for QCM EU & Fact Sheets
  const [qcmSourceMode, setQcmSourceMode] = useState<'all_docs' | 'folder' | 'single_doc'>('all_docs');
  const [qcmSourceFolderId, setQcmSourceFolderId] = useState<string>('');

  const [factSheetSourceMode, setFactSheetSourceMode] = useState<'none' | 'all_docs' | 'folder' | 'single_doc'>('none');
  const [factSheetSourceFolderId, setFactSheetSourceFolderId] = useState<string>('');

  // Local Directory Storage (File System Access API)
  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [dirName, setDirName] = useState<string | null>(null);
  const [dirSyncStatus, setDirSyncStatus] = useState<'none' | 'connected' | 'syncing' | 'error'>('none');

  const saveFileToLocalDir = async (filename: string, content: string | object) => {
    if (!dirHandle) return;
    try {
      const fileHandle = await (dirHandle as any).getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      const data = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
      await writable.write(data);
      await writable.close();
    } catch (e) {
      console.error(`Erreur écriture fichier local (${filename})`, e);
    }
  };

  const deleteFileFromLocalDir = async (filename: string) => {
    if (!dirHandle) return;
    try {
      await (dirHandle as any).removeEntry(filename);
    } catch (e) {
      // Ignorer si le fichier n'existait pas encore sur le disque
    }
  };

  const syncReadFromFolder = async (handle: FileSystemDirectoryHandle) => {
    setDirSyncStatus('syncing');
    try {
      const loadedQuizzes: SavedQuiz[] = [];
      const loadedFactSheets: Array<any> = [];
      const loadedFlashcards: Array<any> = [];
      const loadedAnalyses: Array<any> = [];

      for await (const entry of (handle as any).values()) {
        if (entry.kind === 'file') {
          const file = await entry.getFile();
          if (entry.name.endsWith('.json')) {
            const text = await file.text();
            try {
              const parsed = JSON.parse(text);
              if (parsed.questions && Array.isArray(parsed.questions)) {
                loadedQuizzes.push(parsed);
              } else if (parsed.cards && Array.isArray(parsed.cards)) {
                loadedFlashcards.push(parsed);
              } else if (parsed.concepts || parsed.topic) {
                loadedFactSheets.push(parsed);
              } else if (parsed.executiveSummary || parsed.keyPoints) {
                loadedAnalyses.push(parsed);
              } else if (parsed.app && parsed.data) {
                if (Array.isArray(parsed.data.savedQuizzes)) loadedQuizzes.push(...parsed.data.savedQuizzes);
                if (Array.isArray(parsed.data.savedFactSheets)) loadedFactSheets.push(...parsed.data.savedFactSheets);
                if (Array.isArray(parsed.data.savedFlashcards)) loadedFlashcards.push(...parsed.data.savedFlashcards);
                if (Array.isArray(parsed.data.savedDocAnalyses)) loadedAnalyses.push(...parsed.data.savedDocAnalyses);
              }
            } catch (e) {}
          } else if (entry.name.endsWith('.md')) {
            const text = await file.text();
            const title = entry.name.replace(/\.md$/, '').replace(/_/g, ' ');
            loadedFactSheets.push({
              id: entry.name,
              title,
              content: text,
              createdAt: file.lastModified || Date.now()
            });
          }
        }
      }

      if (loadedQuizzes.length > 0) {
        setSavedQuizzes(prev => {
          const existingIds = new Set(prev.map(q => q.id));
          const newItems = loadedQuizzes.filter(q => !existingIds.has(q.id));
          return [...prev, ...newItems];
        });
      }
      if (loadedFactSheets.length > 0) {
        setSavedFactSheets(prev => {
          const existingIds = new Set(prev.map(s => s.id));
          const newItems = loadedFactSheets.filter(s => !existingIds.has(s.id));
          return [...prev, ...newItems];
        });
      }
      if (loadedFlashcards.length > 0) {
        setSavedFlashcards(prev => {
          const existingIds = new Set(prev.map(f => f.id));
          const newItems = loadedFlashcards.filter(f => !existingIds.has(f.id));
          return [...prev, ...newItems];
        });
      }
      if (loadedAnalyses.length > 0) {
        setSavedDocAnalyses(prev => {
          const existingIds = new Set(prev.map(a => a.id));
          const newItems = loadedAnalyses.filter(a => !existingIds.has(a.id));
          return [...prev, ...newItems];
        });
      }
      setDirSyncStatus('connected');
    } catch (e) {
      console.error("Erreur lors de la lecture du dossier local", e);
      setDirSyncStatus('error');
    }
  };

  const connectLocalFolder = async () => {
    try {
      if (!('showDirectoryPicker' in window)) {
        alert("L'API File System Access n'est pas supportée sur ce navigateur. Veuillez utiliser Chrome ou Edge.");
        return;
      }

      // If we already have a stored handle, try to re-request permission first
      const existingHandle = await get<FileSystemDirectoryHandle>('working_dir_handle');
      if (existingHandle) {
        try {
          const perm = await (existingHandle as any).requestPermission({ mode: 'readwrite' });
          if (perm === 'granted') {
            setDirHandle(existingHandle);
            setDirName(existingHandle.name);
            setDirSyncStatus('connected');
            showLibraryNotification(`Dossier local "${existingHandle.name}" reconnecté !`);
            await syncReadFromFolder(existingHandle);
            return;
          }
        } catch (e) {
          // Permission denied or handle invalid, fall through to showDirectoryPicker
        }
      }

      const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
      setDirHandle(handle);
      setDirName(handle.name);
      setDirSyncStatus('connected');
      await set('working_dir_handle', handle);
      showLibraryNotification(`Dossier local "${handle.name}" connecté avec succès !`);
      await syncReadFromFolder(handle);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error("Erreur lors de la connexion du dossier local", err);
      }
    }
  };

  useEffect(() => {
    get<FileSystemDirectoryHandle>('working_dir_handle').then(async (handle) => {
      if (handle) {
        try {
          let perm = await (handle as any).queryPermission({ mode: 'readwrite' });
          if (perm === 'granted') {
            setDirHandle(handle);
            setDirName(handle.name);
            setDirSyncStatus('connected');
            await syncReadFromFolder(handle);
          } else {
            // Permission lost - store handle name so user knows which folder to reconnect
            setDirName(handle.name + " (Cliquer pour autoriser)");
            setDirSyncStatus('error');
          }
        } catch (e) {
          console.error("Erreur chargement dossier local", e);
          setDirSyncStatus('error');
        }
      }
    }).catch(console.error);

    get('libraryDocuments').then((docs) => {
      if (docs) {
        const parsedDocs = docs.map((d: any) => ({
          ...d,
          url: d.file ? URL.createObjectURL(d.file) : d.url
        }));
        setLibraryDocuments(parsedDocs);
      }
    }).catch(console.error);

    get('libraryFolders').then((folders) => {
      if (folders && Array.isArray(folders)) {
        setLibraryFolders(folders);
      }
    }).catch(console.error);

    get('savedFactSheets').then((sheets) => {
      if (sheets) setSavedFactSheets(sheets);
    }).catch(console.error);

    get('savedFlashcards').then((decks) => {
      if (decks) setSavedFlashcards(decks);
    }).catch(console.error);

    get('savedDocAnalyses').then((analyses) => {
      if (analyses) setSavedDocAnalyses(analyses);
    }).catch(console.error);

    get('savedQuizzes').then((quizzes) => {
      if (quizzes && Array.isArray(quizzes) && quizzes.length > 0) {
        setSavedQuizzes(quizzes);
      }
    }).catch(console.error);

    refreshStorageEstimate();
  }, []);

  useEffect(() => {
    if (libraryDocuments.length > 0) {
       const docsToStore = libraryDocuments.map(d => ({ ...d, url: '' }));
       set('libraryDocuments', docsToStore).catch(console.error);
    }
  }, [libraryDocuments]);

  useEffect(() => {
    set('libraryFolders', libraryFolders).catch(console.error);
  }, [libraryFolders]);

  useEffect(() => {
    set('savedFactSheets', savedFactSheets).catch(console.error);
  }, [savedFactSheets]);

  useEffect(() => {
    set('savedFlashcards', savedFlashcards).catch(console.error);
  }, [savedFlashcards]);

  useEffect(() => {
    set('savedDocAnalyses', savedDocAnalyses).catch(console.error);
  }, [savedDocAnalyses]);

  useEffect(() => {
    if (savedQuizzes.length > 0) {
      set('savedQuizzes', savedQuizzes).catch(console.error);
    }
  }, [savedQuizzes]);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'qcm' | 'english' | 'fact_sheets' | 'library'>('dashboard');
  const [activeQcmTab, setActiveQcmTab] = useState<'numerical' | 'verbal' | 'eu' | 'digcomp' | 'cognitive'>('numerical');
  const [testDifficulties, setTestDifficulties] = useState<Record<string, 'facile' | 'moyen' | 'difficile'>>({});
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [questionLanguage, setQuestionLanguage] = useState<'fr' | 'en'>('fr');
  const [selectedFactSheetDocId, setSelectedFactSheetDocId] = useState<string>('');
  const [selectedEuDocId, setSelectedEuDocId] = useState<string>('all_docs');
  const [factSheetPageStart, setFactSheetPageStart] = useState<number>(1);
  const [factSheetPageEnd, setFactSheetPageEnd] = useState<number>(10);

  useEffect(() => {
    if (selectedFactSheetDocId) {
      const doc = libraryDocuments.find(d => d.id === selectedFactSheetDocId);
      if (doc) {
        setFactSheetPageStart(1);
        setFactSheetPageEnd(doc.numPages ? Math.min(10, doc.numPages) : 10);
      }
    }
  }, [selectedFactSheetDocId, libraryDocuments]);
  
  const [essayPrompt, setEssayPrompt] = useState<{title: string, description: string} | null>(null);
  const [essayText, setEssayText] = useState("");
  const [essayEvaluation, setEssayEvaluation] = useState<{score: number, maxScore: number, feedback: string, corrections: string} | null>(null);
  
  const [factSheetContent, setFactSheetContent] = useState<{title: string, topic?: string, docName?: string, content?: string, concepts?: FactSheetConcept[]} | null>(null);
  const [factSheetLayout, setFactSheetLayout] = useState<'list' | 'grid'>('list');
  const [factSheetAutoEval, setFactSheetAutoEval] = useState(false);
  const [revealedConcepts, setRevealedConcepts] = useState<Record<number, boolean>>({});
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [currentFlashcardIndex, setCurrentFlashcardIndex] = useState(0);
  const [isFlashcardFlipped, setIsFlashcardFlipped] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const libraryFileInputRef = useRef<HTMLInputElement>(null);

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

  const [qcmSubFilter, setQcmSubFilter] = useState<string>('all');

  const matchesQcmSubFilter = (quiz: SavedQuiz, filter: string) => {
    if (filter === 'all') return true;
    const t = quiz.title.toLowerCase();
    const sub = (quiz.subType || '').toLowerCase();
    const cat = (quiz.category || '').toLowerCase();

    if (filter === 'eu_all_knowledge') return sub === 'all_knowledge' || t.includes('toute connaissance') || t.includes('base globale');
    if (filter === 'eu_dates') return sub === 'dates' || t.includes('dates') || t.includes('chronologie');
    if (filter === 'eu_institutions') return sub === 'institutions' || t.includes('institutions') || t.includes('organes');
    if (filter === 'eu_policies') return sub === 'policies' || t.includes('politiques');
    if (filter === 'eu_history') return sub === 'history' || t.includes('histoire') || t.includes('construction');
    if (filter === 'eu_treaties') return sub === 'treaties' || t.includes('traités') || t.includes('droit');
    if (filter === 'eu_figures') return sub === 'figures' || t.includes('données') || t.includes('chiffres');
    if (filter === 'numerical') return cat === 'numerical' || t.includes('numérique') || t.includes('numerical');
    if (filter === 'verbal') return cat === 'verbal' || t.includes('verbal');
    if (filter === 'digcomp') return cat === 'digcomp' || t.includes('digcomp') || t.includes('compétences numériques');
    if (filter === 'english') return cat === 'english' || t.includes('anglais') || t.includes('english');
    return true;
  };

  const getQuizCategoryBadge = (quiz: SavedQuiz) => {
    const t = quiz.title.toLowerCase();
    const sub = (quiz.subType || '').toLowerCase();
    const cat = (quiz.category || '').toLowerCase();

    if (sub === 'all_knowledge' || t.includes('toute connaissance') || t.includes('base globale')) {
      return <span className="bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800 px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1 shrink-0"><Sparkles className="w-3 h-3 text-purple-600 dark:text-purple-400" /> Toute Connaissance RAG</span>;
    }
    if (sub === 'dates' || t.includes('dates') || t.includes('chronologie')) {
      return <span className="bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1 shrink-0"><Calendar className="w-3 h-3 text-amber-600 dark:text-amber-400" /> UE - Dates</span>;
    }
    if (sub === 'institutions' || t.includes('institutions') || t.includes('organes')) {
      return <span className="bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1 shrink-0"><Building2 className="w-3 h-3 text-blue-600 dark:text-blue-400" /> UE - Institutions</span>;
    }
    if (sub === 'policies' || t.includes('politiques')) {
      return <span className="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1 shrink-0"><Globe className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> UE - Politiques</span>;
    }
    if (sub === 'history' || t.includes('histoire') || t.includes('construction')) {
      return <span className="bg-rose-100 dark:bg-rose-900/50 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800 px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1 shrink-0"><Clock className="w-3 h-3 text-rose-600 dark:text-rose-400" /> UE - Histoire</span>;
    }
    if (sub === 'treaties' || t.includes('traités') || t.includes('droit')) {
      return <span className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1 shrink-0"><ShieldCheck className="w-3 h-3 text-indigo-600 dark:text-indigo-400" /> UE - Traités</span>;
    }
    if (sub === 'figures' || t.includes('données') || t.includes('chiffres')) {
      return <span className="bg-cyan-100 dark:bg-cyan-900/50 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1 shrink-0"><Hash className="w-3 h-3 text-cyan-600 dark:text-cyan-400" /> UE - Chiffres</span>;
    }
    if (cat === 'numerical' || t.includes('numérique') || t.includes('numerical')) {
      return <span className="bg-sky-100 dark:bg-sky-900/50 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800 px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1 shrink-0"><Calculator className="w-3 h-3 text-sky-600 dark:text-sky-400" /> Raisonnement Numérique</span>;
    }
    if (cat === 'verbal' || t.includes('verbal')) {
      return <span className="bg-violet-100 dark:bg-violet-900/50 text-violet-800 dark:text-violet-300 border border-violet-200 dark:border-violet-800 px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1 shrink-0"><FileText className="w-3 h-3 text-violet-600 dark:text-violet-400" /> Raisonnement Verbal</span>;
    }
    if (cat === 'digcomp' || t.includes('digcomp') || t.includes('compétences numériques')) {
      return <span className="bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800 px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1 shrink-0"><Monitor className="w-3 h-3 text-purple-600 dark:text-purple-400" /> DigComp 2.2</span>;
    }
    if (cat === 'english' || t.includes('anglais') || t.includes('english')) {
      return <span className="bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800 px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1 shrink-0"><Globe className="w-3 h-3 text-red-600 dark:text-red-400" /> Anglais EUFTE</span>;
    }
    return <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-2.5 py-0.5 rounded-full text-[11px] font-bold shrink-0">QCM</span>;
  };

  const getAIClient = () => {
    const key = userApiKey.trim() || process.env.GEMINI_API_KEY || '';
    return new GoogleGenAI({ apiKey: key });
  };

  const activeModel = selectedModel.trim() || 'gemini-2.5-flash';

  const saveLlmSettings = (mode: 'api' | 'local', url: string, apiKey?: string, model?: string) => {
    setLlmMode(mode);
    setLocalLlmUrl(url);
    localStorage.setItem('qcm_llm_mode', mode);
    localStorage.setItem('qcm_local_url', url);

    if (apiKey !== undefined) {
      setUserApiKey(apiKey);
      localStorage.setItem('qcm_user_api_key', apiKey);
    }

    if (model !== undefined) {
      setSelectedModel(model);
      localStorage.setItem('qcm_selected_model', model);
    }
  };

  // --- FOLDER MANAGEMENT HELPERS ---
  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    const folder: DocumentFolder = {
      id: crypto.randomUUID(),
      name: newFolderName.trim(),
      parentId: newFolderParentId,
      color: newFolderColor,
      createdAt: Date.now()
    };
    setLibraryFolders(prev => [...prev, folder]);
    setNewFolderName('');
    setIsCreateFolderModalOpen(false);
  };

  const handleRenameFolder = (folderId: string, newName: string) => {
    if (!newName.trim()) return;
    setLibraryFolders(prev => prev.map(f => f.id === folderId ? { ...f, name: newName.trim() } : f));
  };

  const handleDeleteFolder = (folderId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (window.confirm("Voulez-vous vraiment supprimer ce dossier ? Les documents et ressources qu'il contient seront déplacés à la racine.")) {
      const getSubfolderIds = (fId: string): string[] => {
        const children = libraryFolders.filter(f => f.parentId === fId).map(f => f.id);
        return [fId, ...children.flatMap(getSubfolderIds)];
      };
      const idsToRemove = getSubfolderIds(folderId);

      setLibraryFolders(prev => prev.filter(f => !idsToRemove.includes(f.id)));
      setLibraryDocuments(prev => prev.map(d => d.folderId && idsToRemove.includes(d.folderId) ? { ...d, folderId: null } : d));

      setSavedQuizzes(prev => {
        const updated = prev.map(q => q.folderId && idsToRemove.includes(q.folderId) ? { ...q, folderId: undefined, folderName: undefined } : q);
        set('savedQuizzes', updated).catch(console.error);
        try { localStorage.setItem('qcm_saved_quizzes', JSON.stringify(updated)); } catch (err) {}
        return updated;
      });

      setSavedDocAnalyses(prev => {
        const updated = prev.map(a => a.folderId && idsToRemove.includes(a.folderId) ? { ...a, folderId: undefined, folderName: undefined } : a);
        set('savedDocAnalyses', updated).catch(console.error);
        return updated;
      });

      setSavedFactSheets(prev => {
        const updated = prev.map(s => s.folderId && idsToRemove.includes(s.folderId) ? { ...s, folderId: undefined, folderName: undefined } : s);
        set('savedFactSheets', updated).catch(console.error);
        return updated;
      });

      setSavedFlashcards(prev => {
        const updated = prev.map(d => d.folderId && idsToRemove.includes(d.folderId) ? { ...d, folderId: undefined, folderName: undefined } : d);
        set('savedFlashcards', updated).catch(console.error);
        return updated;
      });

      if (currentFolderId && idsToRemove.includes(currentFolderId)) {
        setCurrentFolderId(null);
      }
    }
  };

  const showLibraryNotification = (msg: string) => {
    setLibraryNotification(msg);
    setTimeout(() => {
      setLibraryNotification(prev => prev === msg ? null : prev);
    }, 4000);
  };

  const moveDocumentsToFolder = (docIds: string[], targetFolderId: string | null) => {
    setLibraryDocuments(prev => prev.map(d => docIds.includes(d.id) ? { ...d, folderId: targetFolderId } : d));
    const targetFolder = libraryFolders.find(f => f.id === targetFolderId);
    const folderName = targetFolder ? `"${targetFolder.name}"` : 'la Racine';
    showLibraryNotification(`${docIds.length} document(s) déplacé(s) vers ${folderName}`);
    setSelectedDocIdsForMove([]);
    setMoveModalDocIds(null);
  };

  const moveDocumentToFolder = (docId: string, targetFolderId: string | null) => {
    moveDocumentsToFolder([docId], targetFolderId);
  };

  const moveResourceToFolder = (
    type: 'quiz' | 'analysis' | 'fact_sheet' | 'flashcard',
    resourceId: string,
    targetFolderId: string | null
  ) => {
    const targetFolder = libraryFolders.find(f => f.id === targetFolderId);
    const targetFolderName = targetFolder ? targetFolder.name : undefined;

    if (type === 'quiz') {
      setSavedQuizzes(prev => {
        const updated = prev.map(q => q.id === resourceId ? { ...q, folderId: targetFolderId || undefined, folderName: targetFolderName } : q);
        set('savedQuizzes', updated).catch(console.error);
        try { localStorage.setItem('qcm_saved_quizzes', JSON.stringify(updated)); } catch (e) {}
        return updated;
      });
    } else if (type === 'analysis') {
      setSavedDocAnalyses(prev => {
        const updated = prev.map(a => a.id === resourceId ? { ...a, folderId: targetFolderId || undefined, folderName: targetFolderName } : a);
        set('savedDocAnalyses', updated).catch(console.error);
        return updated;
      });
    } else if (type === 'fact_sheet') {
      setSavedFactSheets(prev => {
        const updated = prev.map(s => s.id === resourceId ? { ...s, folderId: targetFolderId || undefined, folderName: targetFolderName } : s);
        set('savedFactSheets', updated).catch(console.error);
        return updated;
      });
    } else if (type === 'flashcard') {
      setSavedFlashcards(prev => {
        const updated = prev.map(d => d.id === resourceId ? { ...d, folderId: targetFolderId || undefined, folderName: targetFolderName } : d);
        set('savedFlashcards', updated).catch(console.error);
        return updated;
      });
    }

    showLibraryNotification(`Élément déplacé vers ${targetFolderName ? `"${targetFolderName}"` : 'la Racine'}`);
    setMoveModalResource(null);
  };

  const renderFolderMoveTreeForResource = (
    resourceType: 'quiz' | 'analysis' | 'fact_sheet' | 'flashcard',
    resourceId: string,
    parentId: string | null = null,
    depth = 0
  ): React.ReactNode[] => {
    const children = libraryFolders.filter(f => (f.parentId || null) === parentId);
    let items: React.ReactNode[] = [];
    for (const folder of children) {
      items.push(
        <div
          key={folder.id}
          className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/40 transition-all mb-2"
          style={{ marginLeft: `${depth * 20}px` }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {depth > 0 && <CornerDownRight className="w-4 h-4 text-slate-400 shrink-0" />}
            <Folder className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
              {folder.name}
            </span>
          </div>
          <button
            onClick={() => moveResourceToFolder(resourceType, resourceId, folder.id)}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition-colors shrink-0 flex items-center gap-1 shadow-xs cursor-pointer"
          >
            <FolderInput className="w-3.5 h-3.5" />
            Déplacer ici
          </button>
        </div>
      );
      items = items.concat(renderFolderMoveTreeForResource(resourceType, resourceId, folder.id, depth + 1));
    }
    return items;
  };

  const matchesGeneratedFolderFilter = (itemFolderId?: string | null) => {
    if (generatedFolderFilter === 'all') return true;
    if (generatedFolderFilter === 'root') return !itemFolderId;
    return itemFolderId === generatedFolderFilter;
  };

  const renderFolderMoveTree = (
    docIdsToMove: string[],
    parentId: string | null = null,
    depth = 0
  ): React.ReactNode[] => {
    const children = libraryFolders.filter(f => (f.parentId || null) === parentId);
    let items: React.ReactNode[] = [];
    for (const folder of children) {
      const docCount = getFolderDocumentCount(folder.id);
      items.push(
        <div
          key={folder.id}
          className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/40 transition-all mb-2"
          style={{ marginLeft: `${depth * 20}px` }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {depth > 0 && <CornerDownRight className="w-4 h-4 text-slate-400 shrink-0" />}
            <Folder className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
              {folder.name}
            </span>
            <span className="text-[10px] px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-full font-semibold shrink-0">
              {docCount} doc{docCount > 1 ? 's' : ''}
            </span>
          </div>
          <button
            onClick={() => moveDocumentsToFolder(docIdsToMove, folder.id)}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition-colors shrink-0 flex items-center gap-1 shadow-xs cursor-pointer"
          >
            <FolderInput className="w-3.5 h-3.5" />
            Déplacer ici
          </button>
        </div>
      );
      items = items.concat(renderFolderMoveTree(docIdsToMove, folder.id, depth + 1));
    }
    return items;
  };

  const getFolderPathBreadcrumbs = (folderId: string | null): DocumentFolder[] => {
    if (!folderId) return [];
    const chain: DocumentFolder[] = [];
    let currId: string | null = folderId;
    while (currId) {
      const f = libraryFolders.find(fold => fold.id === currId);
      if (f) {
        chain.unshift(f);
        currId = f.parentId || null;
      } else {
        break;
      }
    }
    return chain;
  };

  const getFolderDocumentCount = (folderId: string): number => {
    const getSubfolderIds = (fId: string): string[] => {
      const children = libraryFolders.filter(f => f.parentId === fId).map(f => f.id);
      return [fId, ...children.flatMap(getSubfolderIds)];
    };
    const validIds = getSubfolderIds(folderId);
    return libraryDocuments.filter(d => d.folderId && validIds.includes(d.folderId)).length;
  };

  const renderFolderSelectOptions = (parentId: string | null = null, depth = 0): React.ReactNode[] => {
    const children = libraryFolders.filter(f => (f.parentId || null) === parentId);
    let options: React.ReactNode[] = [];
    for (const folder of children) {
      const indent = "   ".repeat(depth) + (depth > 0 ? "↳ " : "");
      options.push(
        <option key={folder.id} value={folder.id}>
          {indent}{folder.name} ({getFolderDocumentCount(folder.id)} doc{getFolderDocumentCount(folder.id) > 1 ? 's' : ''})
        </option>
      );
      options = options.concat(renderFolderSelectOptions(folder.id, depth + 1));
    }
    return options;
  };

  // Unified Multi-Doc & Folder Text Extractor for RAG
  const extractTextFromSource = async (
    sourceMode: 'all_docs' | 'folder' | 'single_doc' | 'none',
    folderId?: string,
    docId?: string,
    startPage: number = 1,
    endPage?: number
  ): Promise<{ text: string, docNames: string[], folderName?: string }> => {
    if (sourceMode === 'none') {
      return { text: '', docNames: [] };
    }

    let docsToProcess: Array<{id: string, name: string, file: File, url: string, numPages: number, type: string, addedAt: number, folderId?: string | null}> = [];
    let folderName = undefined;

    if (sourceMode === 'all_docs') {
      docsToProcess = libraryDocuments;
    } else if (sourceMode === 'folder' && folderId) {
      const f = libraryFolders.find(fold => fold.id === folderId);
      folderName = f?.name;
      const getSubfolderIds = (fId: string): string[] => {
        const children = libraryFolders.filter(fold => fold.parentId === fId).map(fold => fold.id);
        return [fId, ...children.flatMap(getSubfolderIds)];
      };
      const validFolderIds = getSubfolderIds(folderId);
      docsToProcess = libraryDocuments.filter(d => d.folderId && validFolderIds.includes(d.folderId));
    } else if (sourceMode === 'single_doc' && docId) {
      docsToProcess = libraryDocuments.filter(d => d.id === docId);
    }

    if (docsToProcess.length === 0) {
      return { text: '', docNames: [], folderName };
    }

    let combinedText = '';
    const docNames: string[] = [];

    for (const doc of docsToProcess) {
      docNames.push(doc.name);
      let txt = '';
      try {
        if (doc.type === 'pdf') {
          const start = (sourceMode === 'single_doc') ? startPage : 1;
          const end = (sourceMode === 'single_doc' && endPage) ? Math.min(endPage, doc.numPages) : doc.numPages;
          txt = await extractTextFromPdf(doc.file, start, end);
        } else if (doc.type === 'docx') {
          const arrayBuffer = await doc.file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          txt = result.value;
        } else {
          txt = await doc.file.text();
        }
      } catch (e) {
        console.error("Error reading document", doc.name, e);
      }
      combinedText += `\n--- SOURCE: ${doc.name} ---\n${txt}\n`;
    }

    return { text: combinedText.trim(), docNames, folderName };
  };

  // Extract text from AI-extracted data instead of raw text
  const extractAnalysisTextFromSource = async (
    sourceMode: 'all_docs' | 'folder' | 'single_doc' | 'none',
    folderId?: string,
    docId?: string
  ): Promise<{ text: string, docNames: string[], folderName?: string }> => {
    if (sourceMode === 'none') {
      return { text: '', docNames: [] };
    }

    let docsToProcess: Array<{id: string, name: string, file: File, url: string, numPages: number, type: string, addedAt: number, folderId?: string | null}> = [];
    let folderName = undefined;

    if (sourceMode === 'all_docs') {
      docsToProcess = libraryDocuments;
    } else if (sourceMode === 'folder' && folderId) {
      const f = libraryFolders.find(fold => fold.id === folderId);
      folderName = f?.name;
      const getSubfolderIds = (fId: string): string[] => {
        const children = libraryFolders.filter(fold => fold.parentId === fId).map(fold => fold.id);
        return [fId, ...children.flatMap(getSubfolderIds)];
      };
      const validFolderIds = getSubfolderIds(folderId);
      docsToProcess = libraryDocuments.filter(d => d.folderId && validFolderIds.includes(d.folderId));
    } else if (sourceMode === 'single_doc' && docId) {
      docsToProcess = libraryDocuments.filter(d => d.id === docId);
    }

    if (docsToProcess.length === 0) {
      return { text: '', docNames: [], folderName };
    }

    let combinedText = '';
    const docNames: string[] = [];
    const docNamesToMatch = docsToProcess.map(d => d.name);

    // Find all analyses that match the selected documents' names
    const matchedAnalyses = savedDocAnalyses.filter(a => docNamesToMatch.includes(a.docName));

    for (const analysis of matchedAnalyses) {
      if (!docNames.includes(analysis.docName)) {
        docNames.push(analysis.docName);
      }
      
      let txt = `\n--- DONNÉES EXTRAITES PAR L'IA DU DOCUMENT : ${analysis.docName} ---\n`;
      txt += `SYNTHÈSE:\n${analysis.summary}\n\n`;
      
      if (analysis.notions && analysis.notions.length > 0) {
        txt += `NOTIONS CLÉS:\n`;
        analysis.notions.forEach(n => {
          txt += `- [${n.category}] ${n.title}: ${n.summary}\n`;
        });
        txt += `\n`;
      }
      
      if (analysis.keyFigures && analysis.keyFigures.length > 0) {
        txt += `CHIFFRES CLÉS:\n`;
        analysis.keyFigures.forEach(f => {
          txt += `- ${f.figure}: ${f.context}\n`;
        });
        txt += `\n`;
      }
      
      if (analysis.timeline && analysis.timeline.length > 0) {
        txt += `DATES ET CHRONOLOGIE:\n`;
        analysis.timeline.forEach(t => {
          txt += `- ${t.date}: ${t.event}\n`;
        });
        txt += `\n`;
      }
      
      if (analysis.entities && analysis.entities.length > 0) {
        txt += `ACTEURS ET INSTITUTIONS:\n`;
        analysis.entities.forEach(e => {
          txt += `- ${e.name}: ${e.role}\n`;
        });
        txt += `\n`;
      }
      
      if (analysis.takeaways && analysis.takeaways.length > 0) {
        txt += `POINTS À RETENIR:\n`;
        analysis.takeaways.forEach(t => {
          txt += `- ${t}\n`;
        });
        txt += `\n`;
      }
      
      combinedText += txt;
    }

    return { text: combinedText.trim(), docNames, folderName };
  };

  const saveQuiz = (title: string, extractedQuestions: Question[], category?: string, subType?: string, docName?: string) => {
    const newQuiz: SavedQuiz = {
      id: Date.now().toString(),
      title,
      date: new Date().toLocaleDateString(),
      questions: extractedQuestions,
      category,
      subType,
      docName
    };
    const updatedQuizzes = [newQuiz, ...savedQuizzes];
    setSavedQuizzes(updatedQuizzes);
    set('savedQuizzes', updatedQuizzes).catch(console.error);
    saveFileToLocalDir(`quiz_${newQuiz.id}.json`, newQuiz);
  };

  const deleteQuiz = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedQuizzes = savedQuizzes.filter(q => q.id !== id);
    setSavedQuizzes(updatedQuizzes);
    set('savedQuizzes', updatedQuizzes).catch(console.error);
    deleteFileFromLocalDir(`quiz_${id}.json`);
  };

  const loadQuiz = (quiz: SavedQuiz) => {
    setQuestions(quiz.questions);
    setCurrentQuestionIndex(0);
    setScore(0);
    setSelectedAnswerIndex(null);
    setAppState('QUIZ');
  };

type QuizCategory = 'numerical' | 'verbal' | 'eu' | 'digcomp' | 'english' | 'cognitive';
type NumericalType = 'percentages' | 'rule_of_three' | 'evolution_rates' | 'ratios_fractions' | 'equations';
type EnglishType = 'vocabulary' | 'grammar' | 'essay';

const NUMERICAL_TYPES = [
  { id: 'percentages', label: 'Pourcentages' },
  { id: 'rule_of_three', label: 'Règle de trois' },
  { id: 'evolution_rates', label: 'Taux d\'évolution' },
  { id: 'ratios_fractions', label: 'Ratios et fractions' },
  { id: 'equations', label: 'Équations' },
];

const ENGLISH_TYPES = [
  { id: 'vocabulary', label: 'Vocabulaire (UE & Admin)' },
  { id: 'grammar', label: 'Grammaire & Conjugaison' },
  { id: 'essay', label: 'Expression Écrite (EUFTE)' },
];

  const generateEuQuiz = async (
    subType: 'all_knowledge' | 'dates' | 'institutions' | 'policies' | 'history' | 'treaties' | 'figures' = 'dates',
    difficulty: 'facile' | 'moyen' | 'difficile' = 'moyen'
  ) => {
    if (libraryDocuments.length === 0) {
      setError("Veuillez d'abord uploader au moins un document (PDF, Word ou TXT) dans la bibliothèque pour générer un QCM basé sur vos cours.");
      setAppState('UPLOAD');
      setActiveTab('library');
      return;
    }

    setAppState('PROCESSING');
    setError(null);

    const subTypeLabels: Record<string, string> = {
      all_knowledge: "Toute Connaissance RAG",
      dates: "Dates & Chronologie",
      institutions: "Institutions & Organes",
      policies: "Politiques Européennes",
      history: "Histoire & Construction",
      treaties: "Traités & Droit UE",
      figures: "Données & Chiffres Clés"
    };

    const label = subTypeLabels[subType] || "Connaissance UE";
    let diffLabel = difficulty === 'facile' ? "Niveau Facile" : difficulty === 'difficile' ? "Niveau Difficile" : "Niveau Moyen";
    
    const langStr = questionLanguage === 'en' ? 'en anglais (in English)' : 'en français';

    let subTypeInstruction = "";
    switch (subType) {
      case 'all_knowledge':
        subTypeInstruction = "couvrant de manière équilibrée et transversale L'ENSEMBLE DES SUJETS (dates clés, institutions, politiques publiques, histoire, traités et chiffres clés) décrits dans les documents.";
        break;
      case 'dates':
        subTypeInstruction = "focalisées SPÉCIFIQUEMENT sur les DATES CLÉS, la CHRONOLOGIE de la construction européenne, la signature, la ratification et l'entrée en vigueur des traités, ainsi que les échéances politiques et juridiques majeures présentées dans les documents.";
        break;
      case 'institutions':
        subTypeInstruction = "focalisées SPÉCIFIQUEMENT sur les INSTITUTIONS ET ORGANES DE L'UE (Parlement européen, Conseil européen, Conseil de l'UE, Commission européenne, CJUE, BCE, Cour des comptes, SEAE, agences européennes, rôles statutaires et procédures décisionnelles) décrits dans les documents.";
        break;
      case 'policies':
        subTypeInstruction = "focalisées SPÉCIFIQUEMENT sur les POLITIQUES DE L'UNION EUROPÉENNE (PAC, Pacte Vert, Marché Unique, concurrence, numérique, cohésion, PESC) traitées dans les documents.";
        break;
      case 'history':
        subTypeInstruction = "focalisées SPÉCIFIQUEMENT sur l'HISTOIRE DE LA CONSTRUCTION EUROPÉENNE (déclaration Schuman, pères fondateurs, élargissements successifs, étapes historiques) mentionnée dans les documents.";
        break;
      case 'treaties':
        subTypeInstruction = "focalisées SPÉCIFIQUEMENT sur les TRAITÉS ET LE DROIT DE L'UE (CECA, Rome, Acte Unique, Maastricht, Amsterdam, Nice, Lisbonne, directives, règlements, jurisprudences) énoncés dans les documents.";
        break;
      case 'figures':
        subTypeInstruction = "focalisées SPÉCIFIQUEMENT sur les CHIFFRES CLÉS ET DONNÉES STATISTIQUES DE L'UE (budget, Cadre Financier Pluriannuel, pourcentages, démographie, finances) cités dans les documents.";
        break;
    }

    const { text: contextText, docNames, folderName } = await extractAnalysisTextFromSource(
      qcmSourceMode,
      qcmSourceFolderId,
      selectedEuDocId
    );

    if (!contextText || contextText.trim().length === 0) {
      setError("Impossible de générer le QCM : Aucun des documents sélectionnés n'a été analysé par l'IA au préalable. Veuillez d'abord analyser les documents dans la bibliothèque.");
      setAppState('UPLOAD');
      return;
    }

    const sourceDisplay = folderName ? `Dossier "${folderName}"` : docNames.length === 1 ? docNames[0] : `Base globale (${docNames.length} docs)`;
    let title = `QCM UE - ${label} (${diffLabel}) [${sourceDisplay}]`;

    const extractionPrompt = `À partir du/des document(s) source(s) ci-dessous, génère EXACTEMENT ${questionCount} questions à choix multiples ${langStr} de niveau EPSO AD5 Concours.
La difficulté demandée est : ${diffLabel}.
FOCALISATION STRICTE SUR LE THÈME : ${label}.
CONSIGNES OBLIGATOIRES :
1. Les questions doivent être ${subTypeInstruction}
2. Toutes les questions doivent être tirées EXCLUSIVEMENT des faits, dates, événements, chiffres, institutions ou politiques décrits dans le texte des documents fournis.
3. Pour chaque question, dans le champ 'context', insère la citation exacte ou la phrase du document d'où provient la question.
4. Fournis exactement 4 options, l'index de la bonne réponse (0 à 3), et une explication pédagogique détaillée avec référence au document.

RÈGLES CRITIQUES POUR LES RÉPONSES :
5. Les 3 MAUVAISES RÉPONSES (distracteurs) doivent être PLAUSIBLES et CRÉDIBLES. Elles doivent appartenir au même domaine que la bonne réponse (même catégorie d'institution, même type de traité, même époque historique, etc.).
6. NE JAMAIS inclure de réponses absurdes, farfelues ou manifestement fausses.
7. Les 4 options doivent avoir une longueur et un niveau de détail SIMILAIRES.
8. DISTRIBUTION DE LA BONNE RÉPONSE : Répartis la position de correctAnswerIndex de manière UNIFORME entre 0, 1, 2 et 3 sur l'ensemble des ${questionCount} questions. Environ ${Math.max(1, Math.floor(questionCount / 4))} questions par index.

TOUT le contenu généré DOIT être ${langStr}.

DONNÉES EXTRAITES PAR L'IA DES DOCUMENT(S) SOURCE(S) :
${contextText.substring(0, 80000)}`;

    const seed = Math.floor(Math.random() * 1000000);
    const fullPromptWithSkill = `
${QCM_SKILLS['eu']}

---
INSTRUCTIONS SPÉCIFIQUES POUR CE TEST (SEED: ${seed}) :
${extractionPrompt}
`;

    try {
      let extractedQuestions: Question[] = [];
      if (llmMode === 'api') {
        const response = await getAIClient().models.generateContent({
          model: activeModel,
          contents: fullPromptWithSkill,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  context: {
                    type: Type.STRING,
                    description: "Contexte, déclaration ou court extrait du document."
                  },
                  question: {
                    type: Type.STRING,
                    description: "Texte de la question."
                  },
                  options: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Exactement 4 choix de réponse."
                  },
                  correctAnswerIndex: {
                    type: Type.INTEGER,
                    description: "Index (0, 1, 2, 3) de la réponse correcte."
                  },
                  explanation: {
                    type: Type.STRING,
                    description: "Explication claire et détaillée."
                  }
                },
                required: ["question", "options", "correctAnswerIndex"]
              }
            }
          }
        });
        extractedQuestions = JSON.parse(response.text || '[]');
      } else {
        const promptText = `${fullPromptWithSkill}\n\nFormat response as JSON array of objects with keys: "context", "question", "options" (4 strings), "correctAnswerIndex" (0-3), "explanation".`;
        const response = await fetch(localLlmUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama3',
            messages: [
              { role: 'system', content: 'You are an EU EPSO exam creator and output valid JSON.' },
              { role: 'user', content: promptText }
            ],
            response_format: { type: "json_object" }
          })
        });
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || data.response;
        const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
        const jsonString = jsonMatch ? jsonMatch[1] : content;
        extractedQuestions = JSON.parse(jsonString);
      }

      if (extractedQuestions.length === 0) {
        throw new Error("Aucune question n'a pu être générée.");
      }

      // Shuffle options to eliminate position bias (correct answer always on B/C)
      extractedQuestions = extractedQuestions.map(q => {
        if (!q.options || q.options.length !== 4 || q.correctAnswerIndex == null) return q;
        const correctOption = q.options[q.correctAnswerIndex];
        // Fisher-Yates shuffle
        const shuffled = [...q.options];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        const newCorrectIndex = shuffled.indexOf(correctOption);
        return { ...q, options: shuffled, correctAnswerIndex: newCorrectIndex };
      });

      saveQuiz(title, extractedQuestions, 'eu', subType, sourceDisplay);
      setQuestions(extractedQuestions);
      setCurrentQuestionIndex(0);
      setScore(0);
      setSelectedAnswerIndex(null);
      setUserAnswers([]);
      setShowReview(false);
      setAppState('QUIZ');
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Erreur lors de la génération du QCM.");
      setAppState('UPLOAD');
    }
  };

  const generateQuizWithoutDocument = async (category: QuizCategory, subType?: string, difficulty?: 'facile' | 'moyen' | 'difficile', count: number = 5) => {
    if (category === 'eu') {
      return generateEuQuiz((subType as any) || 'general', difficulty || 'moyen');
    }

    setAppState('PROCESSING');
    setError(null);

    let extractionPrompt = "";
    let title = "";
    let isEssay = false;

    let diffLabel = "";
    if (difficulty === 'facile') diffLabel = "Niveau Facile";
    if (difficulty === 'moyen') diffLabel = "Niveau Moyen";
    if (difficulty === 'difficile') diffLabel = "Niveau Difficile";

    let skillKey = category as string;
    if (category === 'english') skillKey = 'english';

    const langStr = questionLanguage === 'en' ? 'en anglais (in English)' : 'en français';
    const explanationLangStr = questionLanguage === 'en' ? 'in English' : 'en français';

    switch (category) {
      case 'numerical':
        let numLabel = "";
        let numPrompt = "";
        
        if (subType === 'percentages') { numLabel = "Pourcentages"; numPrompt = "axées spécifiquement sur des calculs de pourcentages"; }
        else if (subType === 'rule_of_three') { numLabel = "Règle de trois"; numPrompt = "axées spécifiquement sur la règle de trois (proportionnalité)"; }
        else if (subType === 'evolution_rates') { numLabel = "Taux d'évolution"; numPrompt = "axées spécifiquement sur le calcul des taux d'évolution (augmentations, diminutions successives)"; }
        else if (subType === 'ratios_fractions') { numLabel = "Ratios et fractions"; numPrompt = "axées spécifiquement sur la manipulation de ratios et de fractions"; }
        else if (subType === 'equations') { numLabel = "Équations"; numPrompt = "axées spécifiquement sur la résolution d'équations simples et de mises en équation"; }

        title = `Raisonnement Numérique${numLabel ? ' - ' + numLabel : ''} (${diffLabel})`;
        
        extractionPrompt = `Génère EXACTEMENT ${count} questions à choix multiples de raisonnement numérique ${langStr}, de niveau EPSO AD5 Concours${numPrompt ? ', ' + numPrompt : ''}. La difficulté demandée est : ${diffLabel}. Chaque question DOIT inclure un tableau de données (formaté strictement en Markdown dans le champ 'context') OU une courte mise en situation textuelle si c'est plus approprié au type de calcul. Les questions doivent impliquer des calculs liés au type demandé basés sur le tableau ou le texte, et respecter le niveau de difficulté. Fournis exactement 4 options, l'index de la bonne réponse, et une explication détaillée étape par étape montrant le calcul mental ou la logique. TOUT le contenu généré DOIT être ${langStr}.`;
        break;
      case 'verbal':
        title = `Raisonnement Verbal (${diffLabel})`;
        extractionPrompt = `Génère EXACTEMENT ${count} questions à choix multiples de raisonnement verbal ${langStr}, de niveau EPSO AD5 Concours. La difficulté demandée est : ${diffLabel}. Chaque question DOIT inclure un court paragraphe (100-150 mots) dans le champ 'context'. La question doit demander d'identifier l'affirmation correcte selon le texte. Fournis exactement 4 options, l'index de la bonne réponse, et une explication détaillée. TOUT le contenu généré DOIT être ${langStr}.`;
        break;
      case 'digcomp':
        title = `Compétences Numériques (DigComp) (${diffLabel})`;
        extractionPrompt = `Génère EXACTEMENT ${count} questions à choix multiples ${langStr} sur les compétences numériques basées sur le référentiel DigComp 2.2, de niveau EPSO AD5 Concours. La difficulté demandée est : ${diffLabel}. Fournis exactement 4 options, l'index de la bonne réponse, et une explication détaillée. TOUT le contenu généré DOIT être ${langStr}.`;
        break;
      case 'cognitive':
        title = `Raisonnement Cognitif (QI) (${diffLabel})`;
        extractionPrompt = `Génère EXACTEMENT ${count} questions à choix multiples de raisonnement abstrait et cognitif ${langStr} (type test de QI ou EPSO Abstract/Logical Reasoning). Les questions doivent évaluer la déduction logique, les suites logiques (nombres, lettres, ou descriptions de formes géométriques). Comme il s'agit de texte, décris précisément la séquence ou la règle logique (ex: "Quelle est la suite logique de la série suivante...", ou une description textuelle d'un motif). Fournis exactement 4 options, l'index de la bonne réponse, et une explication détaillée expliquant la règle logique pour trouver la solution. TOUT le contenu généré DOIT être ${langStr}.`;
        break;
      case 'english':
        if (subType === 'vocabulary') {
          title = `Anglais - Vocabulaire (${diffLabel})`;
          extractionPrompt = `Generate EXACTLY ${count} multiple-choice questions focusing on English vocabulary relevant to EU institutions and administrative contexts (EPSO AD5 level). The requested difficulty is: ${diffLabel}. Provide the question, exactly 4 options, the correct answer index, and a detailed explanation ${explanationLangStr}.`;
        } else if (subType === 'grammar') {
          title = `Anglais - Grammaire & Conjugaison (${diffLabel})`;
          extractionPrompt = `Generate EXACTLY ${count} multiple-choice questions focusing on English grammar and conjugation (B2/C1 level, relevant to EPSO AD5). The requested difficulty is: ${diffLabel}. Cover tenses, prepositions, conditionals, or complex sentence structures. Provide exactly 4 options, the correct answer index, and a detailed explanation ${explanationLangStr}.`;
        } else if (subType === 'essay') {
          isEssay = true;
          title = "EU Free-Text Essay (EUFTE)";
          // We won't use the LLM to generate QCM. We just need a prompt.
        }
        break;
    }

    const HISTORY_KEY = 'epso_question_history';
    const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}');
    const historyKey = `${category}_${subType || 'all'}_${difficulty || 'all'}`;
    const categoryHistory = history[historyKey] || [];
    const recentQuestions = categoryHistory.slice(-20); // Get last 20 questions
    const seed = Math.floor(Math.random() * 1000000);

    const fullPromptWithSkill = `
${QCM_SKILLS[skillKey] || ''}

---
INSTRUCTIONS SPÉCIFIQUES POUR CE TEST :
${extractionPrompt}

IMPORTANT POUR LA DIVERSITÉ (SEED: ${seed}) :
Afin d'éviter les répétitions, voici quelques concepts/questions que tu as DÉJÀ posés précédemment. NE GÉNÈRE SURTOUT PAS des questions similaires à celles-ci :
${recentQuestions.length > 0 ? recentQuestions.map((q: any) => `- ${q.question}`).join('\n') : 'Aucune question précédente.'}
    `;

    if (isEssay) {
      // For Essay, we just generate a random topic
      const topics = [
        "In your opinion, what are the most significant challenges the European Union faces in implementing a unified digital single market, and how could they be addressed?",
        "Discuss the balance between environmental sustainability and economic growth within the framework of the European Green Deal.",
        "How can the European Union improve citizen engagement and trust in its institutions? Provide concrete examples.",
        "Analyze the impact of artificial intelligence on the future of the European workforce and the role of EU regulations."
      ];
      const randomTopic = topics[Math.floor(Math.random() * topics.length)];
      setEssayPrompt({
        title,
        description: randomTopic
      });
      setEssayText("");
      setEssayEvaluation(null);
      setAppState('ESSAY_WRITING');
      return;
    }

    try {
      let extractedQuestions: Question[] = [];

      if (llmMode === 'api') {
        const response = await getAIClient().models.generateContent({
          model: activeModel,
          contents: fullPromptWithSkill,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  context: {
                    type: Type.STRING,
                    description: "Le contexte de la question, un texte ou un tableau Markdown de données. Laisser vide si non applicable."
                  },
                  question: {
                    type: Type.STRING,
                    description: "Le texte de la question."
                  },
                  options: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.STRING
                    },
                    description: "Exactement 4 options."
                  },
                  correctAnswerIndex: {
                    type: Type.INTEGER,
                    description: "L'index (0, 1, 2, ou 3) de la bonne réponse."
                  },
                  explanation: {
                    type: Type.STRING,
                    description: "Explication détaillée de la réponse."
                  }
                },
                required: ["question", "options", "correctAnswerIndex"]
              }
            }
          }
        });
        extractedQuestions = JSON.parse(response.text || '[]');
      } else {
         // Local LLM Mode (Simplified for generation without document)
         const promptText = `${fullPromptWithSkill}\n\nFormat your response as a JSON array of objects, where each object has the following keys: "context" (string, optional), "question" (string), "options" (array of exactly 4 strings), "correctAnswerIndex" (integer 0-3), and "explanation" (string, optional).`;
         const response = await fetch(localLlmUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama3',
            messages: [
              { role: 'system', content: 'You are a helpful assistant that generates multiple choice questions and outputs ONLY valid JSON.' },
              { role: 'user', content: promptText }
            ],
            response_format: { type: "json_object" },
            temperature: 0.7
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
        throw new Error('No questions could be generated.');
      }

      // Add to history
      const newHistory = { ...history };
      newHistory[historyKey] = [
        ...(newHistory[historyKey] || []),
        ...extractedQuestions.map(q => ({ question: q.question }))
      ];
      localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));

      saveQuiz(`Généré - ${title}`, extractedQuestions, category, subType);
      setQuestions(extractedQuestions);
      setCurrentQuestionIndex(0);
      setScore(0);
      setSelectedAnswerIndex(null);
      setUserAnswers([]);
      setShowReview(false);
      setAppState('QUIZ');

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred while generating the quiz.');
      setAppState('UPLOAD');
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const id = Date.now().toString();

    if (file.type === 'application/pdf') {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const numPages = pdf.numPages;
        const url = URL.createObjectURL(file);
        
        const newDoc = { id, name: file.name, file, url, numPages, type: 'pdf', addedAt: Date.now() };
        setLibraryDocuments(prev => [...prev, newDoc]);
        setUploadedDocument(newDoc);
        setPdfPageRange({ start: 1, end: Math.min(5, numPages) });
        setAppState('DOCUMENT_VIEWER');
      } catch (err: any) {
        setError("Erreur lors de la lecture du PDF: " + err.message);
      }
    } else {
      const url = URL.createObjectURL(file);
      const newDoc = { id, name: file.name, file, url, numPages: 1, type: file.name.endsWith('.docx') ? 'docx' : 'txt', addedAt: Date.now() };
      setLibraryDocuments(prev => [...prev, newDoc]);
      setUploadedDocument(newDoc);
      setAppState('DOCUMENT_VIEWER');
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleLibraryUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const id = Date.now().toString();

    if (file.type === 'application/pdf') {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const numPages = pdf.numPages;
        const url = URL.createObjectURL(file);
        
        const newDoc = { id, name: file.name, file, url, numPages, type: 'pdf', addedAt: Date.now() };
        setLibraryDocuments(prev => [...prev, newDoc]);
      } catch (err: any) {
        setError("Erreur lors de la lecture du PDF: " + err.message);
      }
    } else {
      const url = URL.createObjectURL(file);
      const newDoc = { id, name: file.name, file, url, numPages: 1, type: file.name.endsWith('.docx') ? 'docx' : 'txt', addedAt: Date.now() };
      setLibraryDocuments(prev => [...prev, newDoc]);
    }
    
    // Reset file input
    if (libraryFileInputRef.current) {
      libraryFileInputRef.current.value = '';
    }
  };

  const generateQuizFromDocument = async () => {
    if (!uploadedDocument) return;
    const file = uploadedDocument.file;

    setAppState('PROCESSING');
    setError(null);
    setProcessingProgress(null);

    try {
      const langInstruction = questionLanguage === 'en' ? 'MUST be generated in English' : 'MUST be generated in French';
      
      let ranges = [];
      if (uploadedDocument.type === 'pdf') {
         if (chunkMode === 'manual') {
            ranges.push({ start: pdfPageRange.start, end: pdfPageRange.end });
         } else if (chunkMode === 'auto5') {
            for (let i = 1; i <= uploadedDocument.numPages; i += 5) {
               ranges.push({ start: i, end: Math.min(i + 4, uploadedDocument.numPages) });
            }
         } else if (chunkMode === 'auto20') {
            for (let i = 1; i <= uploadedDocument.numPages; i += 20) {
               ranges.push({ start: i, end: Math.min(i + 19, uploadedDocument.numPages) });
            }
         }
      } else {
         ranges.push({ start: 1, end: 1 });
      }

      setProcessingProgress({ current: 0, total: ranges.length });
      let allExtractedQuestions: Question[] = [];

      for (let i = 0; i < ranges.length; i++) {
        setProcessingProgress({ current: i + 1, total: ranges.length });
        const range = ranges[i];
        let rangeText = uploadedDocument.type === 'pdf' ? `from pages ${range.start} to ${range.end} ` : '';
        
        let chunkQuestionCount = chunkMode === 'manual' ? questionCount : (chunkMode === 'auto5' ? 5 : 10);

        const extractionPrompt = `Extract or generate EXACTLY ${chunkQuestionCount} multiple-choice questions ${rangeText}from this document following the style of the EPSO AD5 Concours. Focus on Verbal Reasoning, Numerical Reasoning (percentages, rule of three, ratios), Abstract Reasoning, EU Knowledge, or Digital Skills (DigComp). If a question refers to a specific text, statement, or data table, extract that information and put it in the 'context' field. IMPORTANT: If the context contains a data table, you MUST format it strictly as a Markdown table. Ensure you capture the question, exactly 4 options, the correct answer index (0-3), and a detailed explanation of why the answer is correct. The ENTIRE output (context, question, options, explanation) ${langInstruction}.`;

        let text = '';
        if (file.type === 'application/pdf') {
          text = await extractTextFromPdf(file, range.start, range.end);
        } else if (file.name.endsWith('.docx')) {
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          text = result.value;
        } else if (file.type === 'text/plain') {
          text = await file.text();
        } else {
          throw new Error('Unsupported file format.');
        }

        const fullPrompt = `${extractionPrompt}\n\nExtracted Text${rangeText ? ' (' + rangeText + ')' : ''}:\n${text}`;

        let jsonString = "[]";
        if (llmMode === 'api') {
          const response = await getAIClient().models.generateContent({
            model: activeModel,
            contents: fullPrompt,
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
                      items: { type: Type.STRING },
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
          jsonString = response.text || '[]';
        } else {
          // Local LLM Mode
          const localPromptText = `${extractionPrompt}\n\nFormat your response as a JSON array of objects, where each object has the following keys: "context" (string, optional), "question" (string), "options" (array of exactly 4 strings), "correctAnswerIndex" (integer 0-3), and "explanation" (string, optional).\n\nText:\n${text}`;

          const response = await fetch(localLlmUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'llama3',
              messages: [
                { role: 'system', content: 'You are a helpful assistant that extracts multiple choice questions and outputs ONLY valid JSON.' },
                { role: 'user', content: localPromptText }
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

          const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
          jsonString = jsonMatch ? jsonMatch[1] : content;
        }
        
        try {
          let parsedData: any = JSON.parse(jsonString);
          if (!Array.isArray(parsedData)) {
            if (parsedData.questions && Array.isArray(parsedData.questions)) {
              parsedData = parsedData.questions;
            } else {
              parsedData = [parsedData];
            }
          }
          allExtractedQuestions = [...allExtractedQuestions, ...parsedData];
        } catch (e) {
          console.error("Failed to parse JSON for chunk", i, e);
        }
      }
      
      if (allExtractedQuestions.length === 0) {
        throw new Error('No questions could be extracted from the document.');
      }

      let quizName = file.name;
      if (uploadedDocument.type === 'pdf') {
        if (chunkMode === 'manual') quizName += ` (p.${pdfPageRange.start}-${pdfPageRange.end})`;
        else quizName += ` (Auto ${chunkMode === 'auto5' ? 5 : 20}p)`;
      }

      saveQuiz(quizName, allExtractedQuestions);
      setQuestions(allExtractedQuestions);
      setCurrentQuestionIndex(0);
      setScore(0);
      setSelectedAnswerIndex(null);
      setUserAnswers([]);
      setShowReview(false);
      setAppState('QUIZ');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred while processing the file.');
      setAppState('DOCUMENT_VIEWER');
    }
    setProcessingProgress(null);
  };

  const generateFactSheetOrVocabFromDocument = async (mode: 'concepts' | 'institutions' | 'history' | 'policies' | 'vocabulary' | 'grammar') => {
    if (!uploadedDocument) return;
    const file = uploadedDocument.file;

    setAppState('PROCESSING');
    setError(null);
    setProcessingProgress(null);

    try {
      const langInstruction = questionLanguage === 'en' ? 'MUST be generated in English' : 'MUST be generated in French';

      let ranges = [];
      if (uploadedDocument.type === 'pdf') {
         if (chunkMode === 'manual') {
            ranges.push({ start: pdfPageRange.start, end: pdfPageRange.end });
         } else if (chunkMode === 'auto5') {
            for (let i = 1; i <= uploadedDocument.numPages; i += 5) {
               ranges.push({ start: i, end: Math.min(i + 4, uploadedDocument.numPages) });
            }
         } else if (chunkMode === 'auto20') {
            for (let i = 1; i <= uploadedDocument.numPages; i += 20) {
               ranges.push({ start: i, end: Math.min(i + 19, uploadedDocument.numPages) });
            }
         }
      } else {
         ranges.push({ start: 1, end: 1 });
      }

      setProcessingProgress({ current: 0, total: ranges.length });
      let allConcepts: FactSheetConcept[] = [];

      for (let i = 0; i < ranges.length; i++) {
        setProcessingProgress({ current: i + 1, total: ranges.length });
        const range = ranges[i];
        let rangeText = uploadedDocument.type === 'pdf' ? `from pages ${range.start} to ${range.end} ` : '';

        let promptText = "";
        const topicSkill = FACT_SHEET_SKILLS[mode] || FACT_SHEET_SKILLS['concepts'];

        if (mode === 'concepts') {
            promptText = `${topicSkill}\n\nExtract key concepts from the provided document ${rangeText}to create a structured revision sheet (fiche de révision). For each important concept, term, or event, provide its definition, an associated date (if applicable/found), a brief explanation, and a concrete example based on the PDF content. The ENTIRE output ${langInstruction}.`;
        } else if (mode === 'institutions') {
            promptText = `${topicSkill}\n\nExtract information ONLY about European Union institutions and bodies from the provided document ${rangeText}. For each institution, provide its name as the 'term', its creation date (if any) as 'date', its primary role and objective as 'explanation', and a concrete example of its actions or composition as 'example'. Ignore unrelated topics. The ENTIRE output ${langInstruction}.`;
        } else if (mode === 'history') {
            promptText = `${topicSkill}\n\nExtract historical events and treaties from the provided document ${rangeText}. For each event/treaty (as 'term'), provide its date ('date'), explain its historical context and links to previous events ('explanation'), and provide a key outcome or example ('example'). Ignore unrelated topics. The ENTIRE output ${langInstruction}.`;
        } else if (mode === 'policies') {
            promptText = `${topicSkill}\n\nExtract key European Union policies and legislative frameworks from the provided document ${rangeText}. For each policy (as 'term'), provide the implementation date/year ('date'), its main objectives and scope ('explanation'), and a concrete application or example ('example'). Ignore unrelated topics. The ENTIRE output ${langInstruction}.`;
        } else if (mode === 'vocabulary') {
            promptText = `Extract important EPSO-level vocabulary words or professional expressions from the provided document ${rangeText}. For each word or expression (as 'term'), provide its definition, leave 'date' empty, provide a brief explanation of its nuances or usage context, and quote the exact sentence where it was used as an 'example'. The ENTIRE output ${langInstruction}.`;
        } else {
            promptText = `Extract key English grammar structures, idioms, or linguistic patterns from the provided document ${rangeText}. For each item (as 'term'), provide the grammatical rule or definition, leave 'date' empty, explain how to use it correctly in a professional context ('explanation'), and provide the exact sentence from the text as an 'example'. The ENTIRE output ${langInstruction}.`;
        }

        let text = '';
        if (file.type === 'application/pdf') {
          text = await extractTextFromPdf(file, range.start, range.end);
        } else if (file.name.endsWith('.docx')) {
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          text = result.value;
        } else if (file.type === 'text/plain') {
          text = await file.text();
        } else {
          throw new Error('Unsupported file format.');
        }

        const fullPrompt = `${promptText}\n\nDocument text:\n${text}`;

        let jsonString = "[]";
        if (llmMode === 'api') {
          const response = await getAIClient().models.generateContent({
            model: activeModel,
            contents: fullPrompt,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    term: { type: Type.STRING, description: "The concept, term, or event name" },
                    definition: { type: Type.STRING, description: "A concise definition" },
                    date: { type: Type.STRING, description: "A relevant date if available, otherwise empty" },
                    explanation: { type: Type.STRING, description: "A brief explanation" },
                    example: { type: Type.STRING, description: "A concrete example based on the document" }
                  },
                  required: ["term", "definition", "explanation", "example"]
                }
              }
            }
          });
          jsonString = response.text || "[]";
        } else {
          const localPromptText = `${promptText}\n\nFormat your response as a JSON array of objects, where each object has the following keys: "term" (string), "definition" (string), "date" (string, optional), "explanation" (string), "example" (string).\n\nText:\n${text}`;
          const response = await fetch(localLlmUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'llama3',
              messages: [
                { role: 'system', content: 'You are an expert tutor creating structured revision sheets and you output ONLY valid JSON.' },
                { role: 'user', content: localPromptText }
              ],
              response_format: { type: "json_object" },
              temperature: 0.3
            })
          });

          if (!response.ok) throw new Error(`Local LLM request failed: ${response.statusText}`);
          
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content || data.response || data.message?.content || "[]";
          const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
          jsonString = jsonMatch ? jsonMatch[1] : content;
        }
        
        try {
          let parsedData: any = JSON.parse(jsonString);
          if (!Array.isArray(parsedData)) {
            if (parsedData.concepts && Array.isArray(parsedData.concepts)) {
              parsedData = parsedData.concepts;
            } else {
              parsedData = [parsedData];
            }
          }
          allConcepts = [...allConcepts, ...parsedData];
        } catch (e) {
          console.error("Failed to parse JSON concepts", e);
        }
      }

      let factSheetTitle = `${mode === 'concepts' ? 'Fiche de Révision' : mode === 'institutions' ? 'Institutions et Organes' : mode === 'history' ? 'Histoire et Traités' : mode === 'policies' ? 'Politiques de l\'UE' : mode === 'vocabulary' ? 'Vocabulaire EPSO' : 'Règles de Grammaire'} - ${file.name}`;
      if (uploadedDocument.type === 'pdf') {
        if (chunkMode === 'manual') factSheetTitle += ` (p.${pdfPageRange.start}-${pdfPageRange.end})`;
        else factSheetTitle += ` (Auto ${chunkMode === 'auto5' ? 5 : 20}p)`;
      }

      const generatedSheet = {
        title: factSheetTitle,
        concepts: allConcepts
      };
      setFactSheetContent(generatedSheet);
      setSavedFactSheets(prev => [...prev, { id: crypto.randomUUID(), ...generatedSheet, createdAt: Date.now() }]);
      setAppState('FACT_SHEET');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred while processing the file.');
      setAppState('DOCUMENT_VIEWER');
    }
    setProcessingProgress(null);
  };

  const analyzeDocument = async (rangeStart?: number, rangeEnd?: number) => {
    if (!uploadedDocument) return;
    const file = uploadedDocument.file;

    setAppState('PROCESSING');
    setError(null);
    setProcessingProgress(null);

    try {
      const start = rangeStart || (uploadedDocument.type === 'pdf' ? pdfPageRange.start : 1);
      const end = rangeEnd || (uploadedDocument.type === 'pdf' ? pdfPageRange.end : 1);
      let rangeText = uploadedDocument.type === 'pdf' ? `(pages ${start} à ${end})` : '';

      let text = '';
      if (file.type === 'application/pdf') {
        text = await extractTextFromPdf(file, start, end);
      } else if (file.name.endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        text = result.value;
      } else if (file.type === 'text/plain') {
        text = await file.text();
      } else {
        throw new Error('Format de fichier non supporté.');
      }

      const seed = Math.floor(Math.random() * 900000) + 100000;
      setCurrentSeed(seed);
      const langInstruction = questionLanguage === 'en' ? 'The ENTIRE output MUST be in English.' : 'Le contenu DOIT être intégralement rédigé en Français.';

      const prompt = `
${DOCUMENT_ANALYSIS_SKILL}

# SYSTEM SEED ENGINE (SEED: #${seed})
Utilise ce SEED (#${seed}) pour orienter l'angle d'analyse et garantir la précision maximale de l'extraction des informations du document.

Analyse scrupuleusement le texte ci-dessous issu du document "${file.name}" ${rangeText}.
${langInstruction}

TEXTE DU DOCUMENT :
${text.substring(0, 80000)}
`;

      let jsonString = "{}";
      if (llmMode === 'api') {
        const response = await getAIClient().models.generateContent({
          model: activeModel,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                summary: { type: Type.STRING, description: "Synthèse détaillée du document" },
                modules: {
                  type: Type.ARRAY,
                  description: "Découpage thématique du document en 2 à 5 modules ou chapitres",
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      moduleNumber: { type: Type.INTEGER },
                      title: { type: Type.STRING, description: "Intitulé du chapitre/module" },
                      description: { type: Type.STRING, description: "Brève présentation du périmètre du chapitre" },
                      notions: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            title: { type: Type.STRING, description: "Nom clair de la notion" },
                            category: { type: Type.STRING, description: "Domaine de compétence EPSO" },
                            summary: { type: Type.STRING, description: "Explication synthétique complète" },
                            keyPoints: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3 à 5 éléments ou règles incontournables" },
                            sourcePage: { type: Type.STRING, description: "Page ou section de référence" }
                          },
                          required: ["title", "category", "summary", "keyPoints"]
                        }
                      }
                    },
                    required: ["moduleNumber", "title", "description", "notions"]
                  }
                },
                keyFigures: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      figure: { type: Type.STRING, description: "Le chiffre, statistique ou montant" },
                      context: { type: Type.STRING, description: "Le contexte exact dans le texte" }
                    },
                    required: ["figure", "context"]
                  }
                },
                entities: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING, description: "Nom de l'institution, organe ou entité" },
                      role: { type: Type.STRING, description: "Rôle ou action mentionnée dans le texte" }
                    },
                    required: ["name", "role"]
                  }
                },
                takeaways: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "5 à 10 points clés incontournables à retenir"
                },
                vocabulary: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      term: { type: Type.STRING, description: "Mot-clé ou terme technique/juridique" },
                      definition: { type: Type.STRING, description: "Définition tirée du texte" }
                    },
                    required: ["term", "definition"]
                  }
                },
                timeline: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      date: { type: Type.STRING, description: "Date ou période" },
                      event: { type: Type.STRING, description: "Événement ou étape juridique associées" }
                    },
                    required: ["date", "event"]
                  }
                }
              },
              required: ["summary", "modules", "keyFigures", "entities", "takeaways", "vocabulary", "timeline"]
            }
          }
        });
        jsonString = response.text || '{}';
      } else {
        const response = await fetch(localLlmUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama3',
            messages: [
              { role: 'system', content: 'Tu es un expert RAG EPSO qui analyse des documents et produit du JSON.' },
              { role: 'user', content: prompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0.3
          })
        });
        if (!response.ok) throw new Error(`Local LLM error: ${response.statusText}`);
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || data.response || "{}";
        const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
        jsonString = jsonMatch ? jsonMatch[1] : content;
      }

      const parsed = JSON.parse(jsonString);

      const rawModules: DocumentModule[] = parsed.modules || [];
      const extractedModules: DocumentModule[] = rawModules.map((mod, modIdx) => ({
        moduleNumber: mod.moduleNumber || (modIdx + 1),
        title: mod.title || `Module ${modIdx + 1}`,
        description: mod.description || '',
        notions: (mod.notions || []).map((n: any, nIdx: number) => ({
          id: `notion-${modIdx + 1}-${nIdx + 1}-${Date.now()}`,
          title: n.title || `Notion ${nIdx + 1}`,
          category: n.category || 'Connaissances UE',
          summary: n.summary || '',
          keyPoints: n.keyPoints || [],
          sourcePage: n.sourcePage || (uploadedDocument.type === 'pdf' ? `p.${start}-${end}` : undefined)
        }))
      }));

      const allNotions: ExtractedNotion[] = extractedModules.flatMap(m => m.notions);

      const analysisObj: DocumentAnalysisResult = {
        id: crypto.randomUUID(),
        docName: file.name,
        pageRange: uploadedDocument.type === 'pdf' ? `p.${start}-${end}` : undefined,
        summary: parsed.summary || 'Aucun résumé disponible.',
        modules: extractedModules,
        notions: allNotions,
        keyFigures: parsed.keyFigures || [],
        entities: parsed.entities || [],
        takeaways: parsed.takeaways || [],
        vocabulary: parsed.vocabulary || [],
        timeline: parsed.timeline || [],
        createdAt: Date.now(),
        seed: seed,
        folderId: uploadedDocument.folderId || undefined,
        folderName: uploadedDocument.folderId ? libraryFolders.find(f => f.id === uploadedDocument.folderId)?.name : undefined
      };

      setDocAnalysisResult(analysisObj);
      setSavedDocAnalyses(prev => [analysisObj, ...prev]);
      setAppState('DOCUMENT_ANALYSIS');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erreur lors de l\'analyse du document.');
      setAppState('DOCUMENT_VIEWER');
    }
  };

  const generateQuizFromNotion = async (notion: ExtractedNotion, docName?: string) => {
    setAppState('PROCESSING');
    setError(null);

    const langInstruction = questionLanguage === 'en' ? 'The ENTIRE output MUST be in English.' : 'Le contenu DOIT être intégralement rédigé en Français.';

    const prompt = `Agis comme un concepteur d'épreuves pour le concours EPSO AD5 Administrateur.

Génère un test de ${questionCount} questions QCM ciblées spécifiquement sur la notion ci-dessous :

NOTION CIBLE :
- Intitulé : ${notion.title}
- Domaine/Catégorie : ${notion.category}
- Explication/Résumé : ${notion.summary}
- Points clés : ${notion.keyPoints.join(' | ')}
${docName ? `- Document source : ${docName}` : ''}

${langInstruction}

Chaque question doit comporter 4 options, 1 seule bonne réponse, et une explication pédagogique détaillée.
Format JSON attendu :
[
  {
    "question": "Texte de la question",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswerIndex": 0,
    "explanation": "Explication fondée sur les textes et principes UE."
  }
]`;

    try {
      let resultJSON = "[]";
      if (llmMode === 'api') {
        const response = await getAIClient().models.generateContent({
          model: activeModel,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  correctAnswerIndex: { type: Type.INTEGER },
                  explanation: { type: Type.STRING }
                },
                required: ["question", "options", "correctAnswerIndex", "explanation"]
              }
            }
          }
        });
        resultJSON = response.text || "[]";
      } else {
        const response = await fetch(localLlmUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama3',
            messages: [
              { role: 'system', content: 'Tu es un expert QCM EPSO AD5 qui génère du JSON array.' },
              { role: 'user', content: prompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0.3
          })
        });
        if (!response.ok) throw new Error(`Local LLM error: ${response.statusText}`);
        const data = await response.json();
        resultJSON = data.choices?.[0]?.message?.content || data.response || "[]";
      }

      const match = resultJSON.match(/\[\s*\{[\s\S]*\}\s*\]/);
      const parsed = JSON.parse(match ? match[0] : resultJSON);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setQuestions(parsed);
        setCurrentQuestionIndex(0);
        setSelectedAnswerIndex(null);
        setScore(0);
        setUserAnswers([]);

        const quizTitle = `QCM Notion : ${notion.title}${docName ? ` (${docName})` : ''}`;
        const sourceFolderId = docAnalysisResult?.folderId || (docName ? libraryDocuments.find(d => d.name === docName)?.folderId : undefined);
        const sourceFolderName = sourceFolderId ? libraryFolders.find(f => f.id === sourceFolderId)?.name : undefined;

        const newQuiz: SavedQuiz = {
          id: crypto.randomUUID(),
          title: quizTitle,
          date: new Date().toLocaleDateString(),
          questions: parsed,
          category: notion.category,
          docName: docName,
          folderId: sourceFolderId || undefined,
          folderName: sourceFolderName
        };
        setSavedQuizzes(prev => [newQuiz, ...prev]);

        setAppState('QUIZ');
      } else {
        throw new Error("Format de QCM invalide généré.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Erreur lors de la génération du QCM pour cette notion.");
      setAppState('DOCUMENT_ANALYSIS');
    }
  };

  const generateFactSheetFromNotion = async (notion: ExtractedNotion, docName?: string) => {
    setAppState('PROCESSING');
    setError(null);

    const langInstruction = questionLanguage === 'en' ? 'The ENTIRE output MUST be in English.' : 'Le contenu DOIT être intégralement rédigé en Français.';

    const prompt = `Agis comme un professeur expert en préparation aux concours européens EPSO.

Rédige une Fiche de Révision complète et hautement structurée sur la notion ci-dessous :

NOTION :
- Intitulé : ${notion.title}
- Catégorie : ${notion.category}
- Résumé : ${notion.summary}
- Points clés : ${notion.keyPoints.join(' | ')}
${docName ? `- Document source : ${docName}` : ''}

${langInstruction}

Format JSON attendu :
{
  "title": "Fiche de Révision : ${notion.title}",
  "concepts": [
    {
      "term": "${notion.title}",
      "definition": "${notion.summary}",
      "date": "Date ou base juridique dans les traités",
      "explanation": "Explication approfondie du cadre institutionnel/réglementaire",
      "example": "Exemple d'application concrète ou jurisprudence"
    }
  ]
}`;

    try {
      let resultJSON = "{}";
      if (llmMode === 'api') {
        const response = await getAIClient().models.generateContent({
          model: activeModel,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                concepts: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      term: { type: Type.STRING },
                      definition: { type: Type.STRING },
                      date: { type: Type.STRING },
                      explanation: { type: Type.STRING },
                      example: { type: Type.STRING }
                    },
                    required: ["term", "definition", "explanation", "example"]
                  }
                }
              },
              required: ["title", "concepts"]
            }
          }
        });
        resultJSON = response.text || "{}";
      } else {
        const response = await fetch(localLlmUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama3',
            messages: [
              { role: 'system', content: 'Tu es un expert EPSO qui génère des fiches au format JSON.' },
              { role: 'user', content: prompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0.3
          })
        });
        if (!response.ok) throw new Error(`Local LLM error: ${response.statusText}`);
        const data = await response.json();
        resultJSON = data.choices?.[0]?.message?.content || data.response || "{}";
      }

      const parsed = JSON.parse(resultJSON);
      if (parsed.title && Array.isArray(parsed.concepts)) {
        const sourceFolderId = docAnalysisResult?.folderId || (docName ? libraryDocuments.find(d => d.name === docName)?.folderId : undefined);
        const sourceFolderName = sourceFolderId ? libraryFolders.find(f => f.id === sourceFolderId)?.name : undefined;

        const newSheet: SavedFactSheet = {
          id: crypto.randomUUID(),
          title: parsed.title,
          concepts: parsed.concepts,
          createdAt: Date.now(),
          category: notion.category,
          docName: docName,
          folderId: sourceFolderId || undefined,
          folderName: sourceFolderName
        };
        setSavedFactSheets(prev => [newSheet, ...prev]);
        setFactSheetContent(newSheet);
        setAppState('FACT_SHEET');
      } else {
        throw new Error("Format de fiche invalide.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Erreur lors de la création de la fiche de révision.");
      setAppState('DOCUMENT_ANALYSIS');
    }
  };

  const generateFlashcardsFromNotion = async (notion: ExtractedNotion, docName?: string) => {
    setAppState('PROCESSING');
    setError(null);

    const langInstruction = questionLanguage === 'en' ? 'The ENTIRE output MUST be in English.' : 'Le contenu DOIT être intégralement rédigé en Français.';

    const prompt = `Crée un paquet de 5 à 8 Flashcards de révision (cartes mémoire) pour la mémorisation active de la notion ci-dessous :

NOTION :
- Intitulé : ${notion.title}
- Catégorie : ${notion.category}
- Résumé : ${notion.summary}
- Points clés : ${notion.keyPoints.join(' | ')}

${langInstruction}

Format JSON attendu :
[
  {
    "front": "Question ou Concept au recto",
    "back": "Définition précise et explication au verso"
  }
]`;

    try {
      let resultJSON = "[]";
      if (llmMode === 'api') {
        const response = await getAIClient().models.generateContent({
          model: activeModel,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  front: { type: Type.STRING },
                  back: { type: Type.STRING }
                },
                required: ["front", "back"]
              }
            }
          }
        });
        resultJSON = response.text || "[]";
      } else {
        const response = await fetch(localLlmUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama3',
            messages: [
              { role: 'system', content: 'Tu es un concepteur de flashcards au format JSON array.' },
              { role: 'user', content: prompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0.3
          })
        });
        if (!response.ok) throw new Error(`Local LLM error: ${response.statusText}`);
        const data = await response.json();
        resultJSON = data.choices?.[0]?.message?.content || data.response || "[]";
      }

      const match = resultJSON.match(/\[\s*\{[\s\S]*\}\s*\]/);
      const parsed = JSON.parse(match ? match[0] : resultJSON);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const deckTitle = `Flashcards : ${notion.title}${docName ? ` (${docName})` : ''}`;
        const sourceFolderId = docAnalysisResult?.folderId || (docName ? libraryDocuments.find(d => d.name === docName)?.folderId : undefined);
        const sourceFolderName = sourceFolderId ? libraryFolders.find(f => f.id === sourceFolderId)?.name : undefined;

        const newDeck: SavedFlashcardDeck = {
          id: crypto.randomUUID(),
          title: deckTitle,
          cards: parsed,
          createdAt: Date.now(),
          category: notion.category,
          docName: docName,
          folderId: sourceFolderId || undefined,
          folderName: sourceFolderName
        };
        setSavedFlashcards(prev => [newDeck, ...prev]);
        setFlashcards(parsed);
        setCurrentFlashcardIndex(0);
        setIsFlashcardFlipped(false);
        setAppState('FLASHCARDS');
      } else {
        throw new Error("Format de flashcards invalide.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Erreur lors de la création des flashcards.");
      setAppState('DOCUMENT_ANALYSIS');
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

  const extractTextFromPdf = async (file: File, startPage: number = 1, endPage?: number): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = '';
    const end = endPage ? Math.min(endPage, pdf.numPages) : pdf.numPages;
    for (let i = startPage; i <= end; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((item: any) => item.str).join(' ') + '\n';
    }
    return text;
  };

  const handleAnswerSelect = (index: number) => {
    if (selectedAnswerIndex !== null) return; // Prevent changing answer
    
    setSelectedAnswerIndex(index);
    const updatedUserAnswers = [...userAnswers];
    updatedUserAnswers[currentQuestionIndex] = index;
    setUserAnswers(updatedUserAnswers);

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

  const evaluateEssay = async () => {
    if (!essayText.trim() || !essayPrompt) return;
    setAppState('PROCESSING');
    setError(null);

    const prompt = `You are an expert English evaluator for EPSO AD5 Concours.
Evaluate the following essay written by a candidate.
Topic: ${essayPrompt.description}

Candidate's Essay:
${essayText}

Provide an evaluation in JSON format exactly like this:
{
  "score": <number out of 20>,
  "feedback": "<detailed feedback in French covering grammar, vocabulary, structure, and relevance to the topic>",
  "corrections": "<suggested corrections or a better version of the weakest parts, in French>"
}`;

    try {
      let evaluationResult;

      if (llmMode === 'api') {
        const response = await getAIClient().models.generateContent({
          model: activeModel,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.INTEGER, description: "Score out of 20" },
                feedback: { type: Type.STRING },
                corrections: { type: Type.STRING }
              },
              required: ["score", "feedback", "corrections"]
            }
          }
        });
        evaluationResult = JSON.parse(response.text || '{}');
      } else {
         const response = await fetch(localLlmUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama3',
            messages: [
              { role: 'system', content: 'You evaluate essays and output valid JSON only.' },
              { role: 'user', content: prompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0.3
          })
        });

        if (!response.ok) throw new Error(`Local LLM request failed: ${response.statusText}`);
        
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || data.response || data.message?.content;
        
        try {
          const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
          const jsonString = jsonMatch ? jsonMatch[1] : content;
          evaluationResult = JSON.parse(jsonString);
        } catch (e) {
          throw new Error('Failed to parse the JSON evaluation response.');
        }
      }

      setEssayEvaluation({
        score: evaluationResult.score || 0,
        maxScore: 20,
        feedback: evaluationResult.feedback || "Aucun retour détaillé.",
        corrections: evaluationResult.corrections || ""
      });
      setAppState('ESSAY_RESULTS');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Une erreur est survenue lors de l\'évaluation.');
      setAppState('ESSAY_WRITING');
    }
  };

  const generateFactSheet = async (topicId: string) => {
    setAppState('PROCESSING');
    setError(null);
    
    const topicLabel = FACT_SHEET_TOPICS.find(t => t.id === topicId)?.label || "Sujet UE";
    const topicSkill = FACT_SHEET_SKILLS[topicId] || FACT_SHEET_SKILLS['concepts'];
    
    const { text: contextText, docNames, folderName } = await extractTextFromSource(
      factSheetSourceMode,
      factSheetSourceFolderId,
      selectedFactSheetDocId,
      factSheetPageStart,
      factSheetPageEnd
    );

    const langInstruction = questionLanguage === 'en' ? 'The ENTIRE output MUST be generated in English.' : 'The ENTIRE output MUST be generated in French.';
    
    let prompt = `Agis comme un professeur expert préparant des candidats au concours EPSO AD5.\n\n${topicSkill}\n\n`;
    if (contextText) {
      const sourceLabel = folderName ? `Dossier "${folderName}"` : docNames.length === 1 ? `Document "${docNames[0]}"` : `${docNames.length} Documents`;
      prompt += `À partir du texte de référence (RAG) extrait de (${sourceLabel}) ci-dessous, extrais et filtre les éléments clés relatifs au thème : "${topicLabel}" pour créer une fiche de révision structurée.\n\nTEXTE DE REFERENCE (RAG):\n${contextText.substring(0, 80000)}\n\nExtrais et filtre scrupuleusement selon la compétence ci-dessus.`;
    } else {
      prompt += `Extrais les concepts clés sur le thème : "${topicLabel}" pour créer une fiche de révision structurée en appliquant scrupuleusement la compétence ci-dessus.\n`;
    }
    prompt += `\nPour chaque concept, terme ou événement important, fournis sa définition, une date associée (si applicable), une brève explication, et un exemple concret pertinent. ${langInstruction}`;

    try {
      let jsonString = "[]";
      if (llmMode === 'api') {
        const response = await getAIClient().models.generateContent({
          model: activeModel,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  term: { type: Type.STRING, description: "The concept, term, or event name" },
                  definition: { type: Type.STRING, description: "A concise definition" },
                  date: { type: Type.STRING, description: "A relevant date if available, otherwise empty" },
                  explanation: { type: Type.STRING, description: "A brief explanation" },
                  example: { type: Type.STRING, description: "A concrete example" }
                },
                required: ["term", "definition", "explanation", "example"]
              }
            }
          }
        });
        jsonString = response.text || "[]";
      } else {
        const localPromptText = `${prompt}\n\nFormat your response as a JSON array of objects, where each object has the following keys: "term" (string), "definition" (string), "date" (string, optional), "explanation" (string), "example" (string).`;
        const response = await fetch(localLlmUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama3',
            messages: [
              { role: 'system', content: 'Tu es un expert en affaires européennes et tu sors uniquement du JSON valide.' },
              { role: 'user', content: localPromptText }
            ],
            response_format: { type: "json_object" },
            temperature: 0.3
          })
        });

        if (!response.ok) throw new Error(`Local LLM request failed: ${response.statusText}`);
        
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || data.response || data.message?.content || "[]";
        const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
        jsonString = jsonMatch ? jsonMatch[1] : content;
      }

      let allConcepts: FactSheetConcept[] = [];
      try {
        let parsedData: any = JSON.parse(jsonString);
        if (!Array.isArray(parsedData)) {
          if (parsedData.concepts && Array.isArray(parsedData.concepts)) {
            parsedData = parsedData.concepts;
          } else {
            parsedData = [parsedData];
          }
        }
        allConcepts = parsedData;
      } catch (e) {
        console.error("Failed to parse JSON concepts", e);
        throw new Error('Erreur lors du parsing de la fiche de révision JSON.');
      }

      const docNameDisplay = docNames.length === 1 ? docNames[0] : docNames.length > 1 ? `${docNames.length} documents` : undefined;
      const titleSuffix = docNameDisplay ? ` - ${docNameDisplay}` : folderName ? ` - Dossier ${folderName}` : '';
      const sheetTitle = `Fiche : ${topicLabel}${titleSuffix}`;
      const generatedSheet = {
        title: sheetTitle,
        concepts: allConcepts,
        createdAt: Date.now(),
        docName: docNameDisplay,
        folderId: factSheetSourceFolderId || undefined,
        folderName: folderName,
        topic: topicId
      };
      setFactSheetContent(generatedSheet);
      setSavedFactSheets(prev => [{ id: crypto.randomUUID(), ...generatedSheet }, ...prev]);
      setAppState('FACT_SHEET');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Une erreur est survenue lors de la génération.');
      setAppState('UPLOAD');
    }
  };

  const generateFlashcards = async (topicId: string) => {
    setAppState('PROCESSING');
    setError(null);
    
    const topicLabel = FACT_SHEET_TOPICS.find(t => t.id === topicId)?.label || "Sujet UE";
    const topicSkill = FACT_SHEET_SKILLS[topicId] || FACT_SHEET_SKILLS['concepts'];
    
    const { text: contextText, docNames, folderName } = await extractTextFromSource(
      factSheetSourceMode,
      factSheetSourceFolderId,
      selectedFactSheetDocId,
      factSheetPageStart,
      factSheetPageEnd
    );

    const langInstruction = questionLanguage === 'en' ? 'The ENTIRE output MUST be generated in English.' : 'The ENTIRE output MUST be generated in French.';

    let prompt = `Agis comme un professeur expert préparant des candidats au concours EPSO AD5.\n\n${topicSkill}\n\n`;
    if (contextText) {
      const sourceLabel = folderName ? `Dossier "${folderName}"` : docNames.length === 1 ? `Document "${docNames[0]}"` : `${docNames.length} Documents`;
      prompt += `Génère 10 flashcards de révisons ciblées en extrayant les informations clés du texte de référence (RAG) extrait de (${sourceLabel}) ci-dessous selon la compétence ci-dessus :\n\nTEXTE DE REFERENCE (RAG):\n${contextText.substring(0, 80000)}\n\n`;
    } else {
      prompt += `Génère 10 flashcards de révisons ciblées sur le thème "${topicLabel}" en appliquant la compétence ci-dessus.\n\n`;
    }
    prompt += `Renvoie le résultat UNIQUEMENT sous forme de JSON valide avec cette structure exacte :
[
  { "front": "Terme ou concept (recto)", "back": "Définition ou explication détaillée (verso)" }
]
${langInstruction}`;

    try {
      let resultJSON = "";
      if (llmMode === 'api') {
        const response = await getAIClient().models.generateContent({
          model: activeModel,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  front: { type: Type.STRING, description: "Terme ou concept sur le recto de la carte" },
                  back: { type: Type.STRING, description: "Définition ou explication détaillée sur le verso" }
                },
                required: ["front", "back"]
              }
            }
          }
        });
        resultJSON = response.text || "[]";
      } else {
        const response = await fetch(localLlmUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama3',
            messages: [
              { role: 'system', content: 'Tu es un expert qui génère des flashcards au format JSON array.' },
              { role: 'user', content: prompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0.3
          })
        });

        if (!response.ok) throw new Error(`Local LLM request failed: ${response.statusText}`);
        
        const data = await response.json();
        resultJSON = data.choices?.[0]?.message?.content || data.response || data.message?.content || "[]";
      }

      try {
        const match = resultJSON.match(/\[\s*\{[\s\S]*\}\s*\]/);
        const parsed = JSON.parse(match ? match[0] : resultJSON);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].front) {
          setFlashcards(parsed);
          setCurrentFlashcardIndex(0);
          setIsFlashcardFlipped(false);

          const docNameDisplay = docNames.length === 1 ? docNames[0] : docNames.length > 1 ? `${docNames.length} documents` : undefined;
          const titleSuffix = docNameDisplay ? ` - ${docNameDisplay}` : folderName ? ` - Dossier ${folderName}` : '';
          const deckTitle = `Flashcards : ${topicLabel}${titleSuffix}`;
          const newDeck = {
            id: crypto.randomUUID(),
            title: deckTitle,
            cards: parsed,
            createdAt: Date.now(),
            docName: docNameDisplay,
            folderId: factSheetSourceFolderId || undefined,
            folderName: folderName,
            topic: topicId
          };
          setSavedFlashcards(prev => [newDeck, ...prev]);

          setAppState('FLASHCARDS');
        } else {
          throw new Error("Format de réponse invalide");
        }
      } catch (e) {
        throw new Error('Erreur lors du parsing des flashcards JSON.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Une erreur est survenue lors de la génération des flashcards.');
      setAppState('UPLOAD');
    }
  };

  const resetApp = () => {
    setAppState('UPLOAD');
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setSelectedAnswerIndex(null);
    setScore(0);
    setUserAnswers([]);
    setShowReview(false);
    setError(null);
    setEssayPrompt(null);
    setEssayText("");
    setEssayEvaluation(null);
    setFactSheetContent(null);
  };

  const handleRetryTest = () => {
    setScore(0);
    setCurrentQuestionIndex(0);
    setSelectedAnswerIndex(null);
    setUserAnswers([]);
    setShowReview(false);
    setAppState('QUIZ');
  };

  const generateCustomReviewSheet = async () => {
    setAppState('PROCESSING');
    setError(null);
    
    const wrongQuestions = questions.filter((q, i) => userAnswers[i] !== q.correctAnswerIndex);
    if (wrongQuestions.length === 0) {
      setFactSheetContent({
        title: "Fiche de Révision Personnalisée",
        content: "Bravo ! Vous n'avez fait aucune erreur sur ce test, pas de points théoriques spécifiques à réviser."
      });
      setAppState('FACT_SHEET');
      return;
    }

    const wrongQuestionsText = wrongQuestions.map((q, i) => 
      `Erreur ${i+1}:\nQuestion: ${q.question}\nBonne réponse: ${q.options[q.correctAnswerIndex]}\nExplication du test: ${q.explanation || 'Non fournie'}`
    ).join('\n\n');

    const prompt = `Agis comme un professeur expert préparant des candidats au concours EPSO AD5.
L'étudiant a fait des erreurs sur les concepts suivants lors de son test :

${wrongQuestionsText}

Génère une fiche de révision ciblée structurée avec les concepts clés à réviser pour l'aider à comprendre ces concepts théoriques, identifier ses lacunes et ne plus faire ces erreurs. Ne te contente pas de répéter les réponses, donne du contexte théorique utile pour le concours.`;

    try {
      let jsonString = "[]";
      if (llmMode === 'api') {
        const response = await getAIClient().models.generateContent({
          model: activeModel,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  term: { type: Type.STRING, description: "The concept, term, or event name" },
                  definition: { type: Type.STRING, description: "A concise definition" },
                  date: { type: Type.STRING, description: "A relevant date if available, otherwise empty" },
                  explanation: { type: Type.STRING, description: "A brief explanation" },
                  example: { type: Type.STRING, description: "A concrete example" }
                },
                required: ["term", "definition", "explanation", "example"]
              }
            }
          }
        });
        jsonString = response.text || "[]";
      } else {
        const localPromptText = `${prompt}\n\nFormat your response as a JSON array of objects, where each object has the following keys: "term" (string), "definition" (string), "date" (string, optional), "explanation" (string), "example" (string).`;
        const response = await fetch(localLlmUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama3',
            messages: [
              { role: 'system', content: 'Tu es un formateur EPSO expert et tu sors uniquement du JSON.' },
              { role: 'user', content: localPromptText }
            ],
            response_format: { type: "json_object" },
            temperature: 0.5
          })
        });

        if (!response.ok) throw new Error(`Local LLM request failed: ${response.statusText}`);
        
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || data.response || data.message?.content || "[]";
        const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
        jsonString = jsonMatch ? jsonMatch[1] : content;
      }

      let allConcepts: FactSheetConcept[] = [];
      try {
        let parsedData: any = JSON.parse(jsonString);
        if (!Array.isArray(parsedData)) {
          if (parsedData.concepts && Array.isArray(parsedData.concepts)) {
            parsedData = parsedData.concepts;
          } else {
            parsedData = [parsedData];
          }
        }
        allConcepts = parsedData;
      } catch (e) {
        console.error("Failed to parse JSON concepts", e);
        throw new Error('Erreur lors du parsing de la fiche de révision JSON.');
      }

      const generatedSheet = {
        title: "Fiche de Révision Ciblée",
        concepts: allConcepts
      };
      setFactSheetContent(generatedSheet);
      setSavedFactSheets(prev => [...prev, { id: crypto.randomUUID(), ...generatedSheet, createdAt: Date.now() }]);
      setAppState('FACT_SHEET');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Une erreur est survenue lors de la génération.');
      setAppState('RESULTS');
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fd] dark:bg-slate-950 text-[#191c1f] dark:text-slate-100 font-sans selection:bg-[#76a9c5]/20 selection:text-[#003e54] transition-colors">
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-30 transition-colors shadow-2xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {appState !== 'UPLOAD' && (
              <button 
                onClick={resetApp}
                className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 hover:text-[#2f647e] dark:hover:text-[#76a9c5] bg-slate-100/80 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700 px-3.5 py-1.5 rounded-xl transition-all cursor-pointer border border-slate-200/60 dark:border-slate-700"
                title="Retour au menu principal"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="font-semibold text-xs tracking-wider uppercase hidden sm:inline">Retour</span>
              </button>
            )}
            <div className="flex items-center gap-2.5 cursor-pointer group" onClick={resetApp}>
              <div className="bg-[#2f647e] p-2 rounded-xl text-white shrink-0 shadow-xs group-hover:bg-[#244f64] transition-colors">
                <Award className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <h1 className="text-xl font-bold tracking-tight font-serif text-[#191c1f] dark:text-white group-hover:text-[#2f647e] dark:group-hover:text-[#76a9c5] transition-colors">Prépa EPSO AD5</h1>
                <span className="text-[10px] font-semibold text-[#71787d] dark:text-slate-400 tracking-wider uppercase -mt-1 hidden sm:block">Concours Administrateur Horizon</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                refreshStorageEstimate();
                setIsDbArchitectureModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-[#003e54] dark:text-[#9acdeb] hover:text-[#002736] bg-[#76a9c5]/15 dark:bg-[#2f647e]/30 hover:bg-[#76a9c5]/25 rounded-xl transition-all cursor-pointer border border-[#2f647e]/20 dark:border-[#76a9c5]/30 shadow-2xs"
              title="Architecture & Métriques de la Base de Données"
            >
              <Database className="w-4 h-4 text-[#2f647e] dark:text-[#76a9c5]" />
              <span className="hidden sm:inline font-semibold">Base DB</span>
            </button>

            <button
              onClick={connectLocalFolder}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer border shadow-2xs",
                dirSyncStatus === 'connected'
                  ? "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700"
                  : "text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700"
              )}
              title={dirName ? `Dossier actif : ${dirName}` : "Connecter un dossier local pour enregistrer et lire automatiquement les fichiers"}
            >
              <FolderKanban className="w-4 h-4" />
              <span className="hidden sm:inline font-semibold">
                {dirName ? `Dossier: ${dirName}` : "Dossier local"}
              </span>
            </button>

            <button
              onClick={() => setShowSettings(true)}
              className="p-2 text-[#41484c] dark:text-slate-400 hover:text-[#2f647e] dark:hover:text-[#76a9c5] hover:bg-[#76a9c5]/10 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
              title="Paramètres LLM"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={toggleTheme}
              className="p-2 text-[#41484c] dark:text-slate-400 hover:text-[#2f647e] dark:hover:text-[#76a9c5] hover:bg-[#76a9c5]/10 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
              title="Changer de thème"
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
            {appState === 'QUIZ' && (
              <div className="flex items-center gap-3">
                <div className="text-xs font-semibold text-[#41484c] dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-xl border border-slate-200 dark:border-slate-700 hidden sm:block">
                  Question {currentQuestionIndex + 1} / {questions.length}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {showSettings && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Settings className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Paramètres LLM</h2>
                </div>
                <button
                  onClick={() => setShowSettings(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full transition-colors"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Mode de Génération</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => saveLlmSettings('api', localLlmUrl, userApiKey, selectedModel)}
                      className={cn(
                        "flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all",
                        llmMode === 'api' 
                          ? "border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 font-semibold" 
                          : "border-slate-200 hover:border-indigo-300 text-slate-600 dark:border-slate-700 dark:text-slate-400"
                      )}
                    >
                      <Cloud className="w-5 h-5" />
                      <span>Gemini API</span>
                    </button>
                    <button
                      onClick={() => saveLlmSettings('local', localLlmUrl, userApiKey, selectedModel)}
                      className={cn(
                        "flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all",
                        llmMode === 'local' 
                          ? "border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 font-semibold" 
                          : "border-slate-200 hover:border-indigo-300 text-slate-600 dark:border-slate-700 dark:text-slate-400"
                      )}
                    >
                      <Server className="w-5 h-5" />
                      <span>LLM Local</span>
                    </button>
                  </div>
                </div>

                {llmMode === 'api' && (
                  <div className="space-y-5 pt-2 border-t border-slate-100 dark:border-slate-800">
                    {/* Clé API Gemini */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                          <Key className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          Clé API Gemini
                        </label>
                        {userApiKey.trim() ? (
                          <span className="text-xs bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 px-2.5 py-0.5 rounded-full font-medium">
                            Clé personnalisée active
                          </span>
                        ) : (
                          <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2.5 py-0.5 rounded-full font-medium">
                            Clé système par défaut
                          </span>
                        )}
                      </div>
                      
                      <div className="relative">
                        <input
                          type={showApiKey ? "text" : "password"}
                          value={userApiKey}
                          onChange={(e) => saveLlmSettings('api', localLlmUrl, e.target.value, selectedModel)}
                          className="w-full pl-4 pr-10 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                          placeholder="Collez votre clé API Gemini (AIzaSy...)"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-md"
                          title={showApiKey ? "Masquer la clé" : "Afficher la clé"}
                        >
                          {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      
                      {userApiKey.trim() && (
                        <div className="mt-2 flex items-center justify-between">
                          <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5" /> Clé stockée dans le navigateur (LocalStorage)
                          </p>
                          <button
                            type="button"
                            onClick={() => saveLlmSettings('api', localLlmUrl, '', selectedModel)}
                            className="text-xs text-rose-600 dark:text-rose-400 hover:underline font-medium"
                          >
                            Effacer la clé
                          </button>
                        </div>
                      )}

                      <div className="mt-2.5 p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-xs text-blue-900 dark:text-blue-200 space-y-1">
                        <div className="font-semibold flex items-center gap-1.5 text-blue-800 dark:text-blue-300">
                          <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          Conseil Sécurité Tablettes & Appareils
                        </div>
                        <p className="text-[11px] leading-relaxed text-blue-800/90 dark:text-blue-300/90">
                          Si vous laissez ce champ <strong>vide</strong>, l'application utilise la <strong>clé serveur intégrée</strong>, ce qui est l'option la plus sécurisée (aucune clé stockée sur votre tablette).
                        </p>
                      </div>
                    </div>

                    {/* Modèle Gemini - Sous-classements Flash vs Pro */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          Choix du Modèle Gemini
                        </label>
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                          {selectedModel}
                        </span>
                      </div>

                      {/* Selecteur de sous-classement (Gamme Flash vs Gamme Pro) */}
                      <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700 mb-3 gap-1 shadow-xs">
                        <button
                          type="button"
                          onClick={() => setModelCategoryTab('flash')}
                          className={cn(
                            "py-2.5 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer border",
                            modelCategoryTab === 'flash'
                              ? "bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800 shadow-sm"
                              : "text-slate-600 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white"
                          )}
                        >
                          <Zap className="w-4 h-4 text-amber-500 shrink-0" />
                          <span>Modèles Flash</span>
                          <span className="px-1.5 py-0.2 text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 rounded-full font-extrabold">⚡ Rapidité</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setModelCategoryTab('pro')}
                          className={cn(
                            "py-2.5 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer border",
                            modelCategoryTab === 'pro'
                              ? "bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800 shadow-sm"
                              : "text-slate-600 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white"
                          )}
                        >
                          <Brain className="w-4 h-4 text-purple-500 shrink-0" />
                          <span>Modèles Pro</span>
                          <span className="px-1.5 py-0.2 text-[10px] bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 rounded-full font-extrabold">🧠 Raisonnement</span>
                        </button>
                      </div>

                      {/* Sous-classement Flash */}
                      {modelCategoryTab === 'flash' && (
                        <div className="space-y-2 mb-3">
                          <div className="p-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs text-amber-900 dark:text-amber-300 flex items-center gap-2">
                            <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                            <span><strong>Gamme Flash :</strong> Réponses instantanées, latence minime, optimisé pour les QCM en direct et les Flashcards.</span>
                          </div>

                          <div className="grid grid-cols-1 gap-2">
                            {[
                              { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash', desc: 'Dernier modèle rapide, recommandé pour la réactivité', badge: 'Recommandé ⚡' },
                              { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', desc: 'Très rapide, équilibré & faible consommation', badge: 'Populaire' },
                              { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', desc: 'Performant, polyvalent & réponses courtes', badge: 'Standard' },
                              { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', desc: 'Ultra-rapide, génération instantanée', badge: 'Ultra-Rapide' },
                              { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview', desc: 'Aperçu de la nouvelle génération Flash', badge: 'Preview' },
                              { id: 'gemini-flash', name: 'Gemini Flash (Alias)', desc: 'Redirection automatique vers la dernière version Flash stable', badge: 'Alias Auto' },
                            ].map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => {
                                  saveLlmSettings('api', localLlmUrl, userApiKey, m.id);
                                  setCustomModelInput('');
                                }}
                                className={cn(
                                  "flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer",
                                  selectedModel === m.id
                                    ? "border-amber-500 bg-amber-50/80 dark:bg-amber-950/50 text-amber-950 dark:text-amber-100 ring-2 ring-amber-400 font-semibold"
                                    : "border-slate-200 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-800 bg-white dark:bg-slate-800/50 text-slate-700 dark:text-slate-300"
                                )}
                              >
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-sm">{m.name}</span>
                                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200">
                                      {m.badge}
                                    </span>
                                  </div>
                                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{m.desc}</div>
                                </div>
                                {selectedModel === m.id && (
                                  <CheckCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 ml-2" />
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Sous-classement Pro */}
                      {modelCategoryTab === 'pro' && (
                        <div className="space-y-2 mb-3">
                          <div className="p-2.5 rounded-xl bg-purple-50/80 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900 text-xs text-purple-900 dark:text-purple-300 flex items-center gap-2">
                            <Brain className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                            <span><strong>Gamme Pro :</strong> Raisonnement logique de pointe, haute précision juridique, idéal pour les fiches thématiques et l'analyse complexe.</span>
                          </div>

                          <div className="grid grid-cols-1 gap-2">
                            {[
                              { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro Preview', desc: 'Raisonnement de pointe, réflexion logique profonde', badge: 'Recommandé 🧠' },
                              { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', desc: 'Haute précision & analyse complexe de traités de l\'UE', badge: 'Haute Précision' },
                              { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', desc: 'Grand contexte étendu (jusqu\'à 2M de tokens de cours)', badge: 'Contexte 2M' },
                              { id: 'gemini-pro', name: 'Gemini Pro (Alias)', desc: 'Redirection automatique vers la dernière version Pro stable', badge: 'Alias Auto' },
                            ].map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => {
                                  saveLlmSettings('api', localLlmUrl, userApiKey, m.id);
                                  setCustomModelInput('');
                                }}
                                className={cn(
                                  "flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer",
                                  selectedModel === m.id
                                    ? "border-purple-500 bg-purple-50/80 dark:bg-purple-950/50 text-purple-950 dark:text-purple-100 ring-2 ring-purple-400 font-semibold"
                                    : "border-slate-200 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-800 bg-white dark:bg-slate-800/50 text-slate-700 dark:text-slate-300"
                                )}
                              >
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-sm">{m.name}</span>
                                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-200">
                                      {m.badge}
                                    </span>
                                  </div>
                                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{m.desc}</div>
                                </div>
                                {selectedModel === m.id && (
                                  <CheckCircle className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 ml-2" />
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Modèle personnalisé */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                          Ou saisir le nom exact d'un autre modèle :
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={customModelInput || (!['gemini-3.6-flash', 'gemini-3.1-pro-preview', 'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-3-flash-preview', 'gemini-flash', 'gemini-pro'].includes(selectedModel) ? selectedModel : '')}
                            onChange={(e) => {
                              setCustomModelInput(e.target.value);
                              if (e.target.value.trim()) {
                                saveLlmSettings('api', localLlmUrl, userApiKey, e.target.value.trim());
                              }
                            }}
                            placeholder="ex: gemini-2.0-flash-thinking-exp"
                            className="flex-1 px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {llmMode === 'local' && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <label htmlFor="localUrl" className="block text-sm font-semibold text-slate-900 dark:text-white mb-2">
                      URL LLM Local (Compatible OpenAI)
                    </label>
                    <input
                      type="text"
                      id="localUrl"
                      value={localLlmUrl}
                      onChange={(e) => saveLlmSettings('local', e.target.value, userApiKey, selectedModel)}
                      className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                      placeholder="http://localhost:11434/v1/chat/completions"
                    />
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      Assurez-vous que votre serveur local (Ollama, LM Studio...) fonctionne et autorise CORS.
                    </p>
                  </div>
                )}

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowSettings(false);
                      refreshStorageEstimate();
                      setIsDbArchitectureModalOpen(true);
                    }}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/80 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-800 rounded-xl transition-all cursor-pointer"
                  >
                    <Database className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Architecture Base de Données</span>
                  </button>

                  <button
                    onClick={() => setShowSettings(false)}
                    className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-xl transition-colors shadow-sm cursor-pointer"
                  >
                    Enregistrer & Fermer
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Architecture Base de Données (IndexedDB & Notions) */}
        {isDbArchitectureModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
              {/* Header Modal */}
              <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                    <Database className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Architecture Base de Données</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Stockage haute performance IndexedDB & Moteur d'indexation de Notions</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDbArchitectureModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Status Banner */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white shadow-md mb-6 relative overflow-hidden">
                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span className="text-xs font-bold uppercase tracking-wider text-indigo-200">Stockage Local Unifié (IndexedDB)</span>
                    </div>
                    <h3 className="text-lg font-bold">Capacité Illimitée pour des Milliers de Notions</h3>
                    <p className="text-xs text-indigo-200/90 mt-1">Vos fiches, QCMs, cours PDF et cartes mémoires sont indexés localement sans alourdir ni ralentir l'application.</p>
                  </div>

                  <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-xl border border-white/15 text-center shrink-0">
                    <div className="text-xs text-indigo-200 font-medium">Espace Consommé</div>
                    <div className="text-xl font-extrabold text-white">{dbStorageEstimate?.usageMB || '0'} MB</div>
                    <div className="text-[10px] text-indigo-300">sur ~{dbStorageEstimate?.quotaGB || '---'} GB disponibles</div>
                  </div>
                </div>
              </div>

              {/* Stores / Tables Breakdown */}
              <div className="mb-6">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Tables & Stores de la Base de Données
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Documents Sources</div>
                    <div className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">{libraryDocuments.length}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Fichiers PDF / DOCX</div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Base de QCMs</div>
                    <div className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">{savedQuizzes.length}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Séries de questions</div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Fiches Thématiques</div>
                    <div className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">{savedFactSheets.length}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Synthèses de notions</div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Flashcard Decks</div>
                    <div className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">{savedFlashcards.length}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Jeux de mémorisation</div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Analyses RAG</div>
                    <div className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">{savedDocAnalyses.length}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Rapports détaillés</div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Arborescence Notions</div>
                    <div className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">{libraryFolders.length}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Dossiers organisés</div>
                  </div>
                </div>
              </div>

              {/* Notions Index Breakdown */}
              <div className="mb-6 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                    <FolderTree className="w-4 h-4 text-indigo-500" />
                    Indexation Automatique des Notions
                  </h3>
                  <span className="text-[11px] text-slate-500">Moteur de recherche rapide activé</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                  Toutes vos fiches de cours, QCMs et documents sont organisés par thématiques d'examen EPSO AD5 pour un chargement instantané.
                </p>
                <div className="flex flex-wrap gap-2">
                  {FACT_SHEET_TOPICS.map((topic) => {
                    const count = savedFactSheets.filter(f => f.topic === topic.id).length;
                    return (
                      <span
                        key={topic.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 shadow-2xs"
                      >
                        <span>{topic.label || topic.id}</span>
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                          {count}
                        </span>
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Backup & Import Actions */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleExportDatabase}
                    className="flex-1 sm:flex-initial px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Exporter la DB (JSON)</span>
                  </button>

                  <label className="flex-1 sm:flex-initial px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl transition-all border border-slate-300 dark:border-slate-700 flex items-center justify-center gap-2 cursor-pointer">
                    <UploadCloud className="w-4 h-4 text-indigo-500" />
                    <span>Importer DB (JSON)</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportDatabase}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      refreshStorageEstimate();
                      setLibraryNotification("🔄 Index de la base de données rafraîchi avec succès !");
                    }}
                    className="px-3 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                    title="Re-indexer la base de données"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Re-indexer</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsDbArchitectureModalOpen(false)}
                    className="px-5 py-2.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs rounded-xl hover:opacity-90 transition-all cursor-pointer"
                  >
                    Fermer
                  </button>
                </div>
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

        {appState === 'DOCUMENT_VIEWER' && uploadedDocument && (
          <div className="max-w-6xl mx-auto h-[calc(100vh-120px)] flex flex-col md:flex-row gap-6 animate-in fade-in">
            <div className="flex-1 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col relative min-h-[60vh] md:min-h-0">
              {uploadedDocument.type === 'pdf' ? (
                <object data={uploadedDocument.url} type="application/pdf" className="w-full h-full min-h-[60vh] md:min-h-full border-none" title="Liseuse PDF">
                  <div className="w-full h-full p-8 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-800 text-slate-500 text-center">
                    <FileText className="w-16 h-16 mb-4 opacity-50 text-indigo-400" />
                    <span className="text-xl font-medium mb-4 text-slate-700 dark:text-slate-300">Le navigateur a bloqué l'aperçu du PDF.</span>
                    <a href={uploadedDocument.url} target="_blank" rel="noopener noreferrer" className="bg-indigo-600 text-white px-6 py-2 rounded-xl hover:bg-indigo-700 transition-colors font-medium">Ouvrir le PDF dans un nouvel onglet</a>
                  </div>
                </object>
              ) : (
                <div className="w-full h-full p-8 flex items-center justify-center bg-slate-50 dark:bg-slate-800 text-slate-500">
                  <FileText className="w-16 h-16 mr-4 opacity-50" />
                  <span className="text-xl font-medium">Document lu avec succès.</span>
                </div>
              )}
            </div>
            
            <div className="w-full md:w-[400px] flex flex-col gap-6 shrink-0">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 md:p-8 rounded-3xl shadow-lg relative overflow-hidden">
                {/* En-tete du panneau */}
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold font-heading text-slate-900 dark:text-white leading-tight">
                      Configuration Analyse IA
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Personnalisez l'extraction et la génération
                    </p>
                  </div>
                </div>
                
                {/* Plage de pages pour PDF */}
                {uploadedDocument.type === 'pdf' && uploadedDocument.numPages > 0 && (
                  <div className="mb-6">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5 font-heading">
                      Segmentation ({uploadedDocument.numPages} pages)
                    </label>
                    <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 mb-3 border border-slate-200/80 dark:border-slate-700/80">
                      <button
                        onClick={() => setChunkMode('manual')}
                        className={cn(
                          "flex-1 px-2 py-1.5 rounded-lg text-xs font-bold transition-all",
                          chunkMode === 'manual'
                            ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                            : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                        )}
                      >
                        Manuel
                      </button>
                      <button
                        onClick={() => setChunkMode('auto5')}
                        className={cn(
                          "flex-1 px-2 py-1.5 rounded-lg text-xs font-bold transition-all",
                          chunkMode === 'auto5'
                            ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                            : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                        )}
                      >
                        Auto (5p)
                      </button>
                      <button
                        onClick={() => setChunkMode('auto20')}
                        className={cn(
                          "flex-1 px-2 py-1.5 rounded-lg text-xs font-bold transition-all",
                          chunkMode === 'auto20'
                            ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                            : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                        )}
                      >
                        Auto (20p)
                      </button>
                    </div>

                    {chunkMode === 'manual' && (
                      <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
                        <div className="flex-1">
                          <span className="text-[11px] font-semibold text-slate-500 mb-1 block">De la page</span>
                          <input 
                            type="number" 
                            min={1} 
                            max={pdfPageRange.end} 
                            value={pdfPageRange.start}
                            onChange={(e) => setPdfPageRange({...pdfPageRange, start: parseInt(e.target.value) || 1})}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold outline-none focus:border-indigo-500 dark:focus:border-indigo-400"
                          />
                        </div>
                        <span className="text-slate-400 font-bold mt-4">à</span>
                        <div className="flex-1">
                          <span className="text-[11px] font-semibold text-slate-500 mb-1 block">À la page</span>
                          <input 
                            type="number" 
                            min={pdfPageRange.start} 
                            max={uploadedDocument.numPages} 
                            value={pdfPageRange.end}
                            onChange={(e) => setPdfPageRange({...pdfPageRange, end: parseInt(e.target.value) || pdfPageRange.start})}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold outline-none focus:border-indigo-500 dark:focus:border-indigo-400"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Langue de sortie */}
                <div className="mb-6">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 font-heading">
                    Langue de sortie
                  </label>
                  <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 border border-slate-200/80 dark:border-slate-700/80">
                    <button
                      onClick={() => setQuestionLanguage('fr')}
                      className={cn(
                        "flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all",
                        questionLanguage === 'fr'
                          ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                          : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                      )}
                    >
                      Français (FR)
                    </button>
                    <button
                      onClick={() => setQuestionLanguage('en')}
                      className={cn(
                        "flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all",
                        questionLanguage === 'en'
                          ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                          : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                      )}
                    >
                      English (EN)
                    </button>
                  </div>
                </div>

                {/* Type de traitement IA */}
                <div className="mb-6">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 font-heading">
                    Type de traitement IA
                  </label>
                  <select 
                    value={docProcessingType}
                    onChange={(e) => setDocProcessingType(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 dark:focus:border-indigo-400 font-bold text-xs text-slate-800 dark:text-slate-200 custom-select"
                  >
                    <option value="document_analysis">Analyse Complète RAG (Synthèse, Chiffres, Acteurs)</option>
                    <option value="qcm">QCM Connaissance de l'UE (RAG Extraite)</option>
                    <option value="fact_sheet_general">Fiche de révision générale (Concepts clés)</option>
                    <option value="fact_sheet_institutions">Fiche thématique: Institutions et Organes</option>
                    <option value="fact_sheet_history">Fiche thématique: Histoire et Traités</option>
                    <option value="fact_sheet_policies">Fiche thématique: Politiques Européennes</option>
                    <option value="vocab">Vocabulaire & Acronymes EPSO</option>
                    <option value="english">Anglais EPSO & Structure Administrative</option>
                  </select>
                </div>

                {/* Bouton d'action principal */}
                <button
                  onClick={() => {
                     if (docProcessingType === 'document_analysis') {
                        analyzeDocument();
                     } else if (docProcessingType === 'qcm') {
                        generateQuizFromDocument();
                     } else {
                        const mode = docProcessingType === 'fact_sheet_general' ? 'concepts' 
                                   : docProcessingType === 'fact_sheet_institutions' ? 'institutions'
                                   : docProcessingType === 'fact_sheet_history' ? 'history'
                                   : docProcessingType === 'fact_sheet_policies' ? 'policies'
                                   : docProcessingType === 'vocab' ? 'vocabulary' : 'grammar';
                        generateFactSheetOrVocabFromDocument(mode);
                     }
                  }}
                  className="w-full bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-700 hover:to-emerald-700 text-white font-bold py-3.5 px-6 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-98 text-sm font-heading cursor-pointer"
                >
                  <BrainCircuit className="w-5 h-5" />
                  <span>Lancer l'Analyse IA</span>
                </button>
                
                <button
                  onClick={() => setAppState('UPLOAD')}
                  className="w-full mt-3 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 font-semibold py-2.5 px-6 rounded-xl transition-colors text-xs text-center"
                >
                  Retour au chargement
                </button>
              </div>
            </div>
          </div>
        )}
        {appState === 'UPLOAD' && (
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <span className="inline-block py-1 px-4 rounded-full bg-[#76a9c5]/15 text-[#003e54] dark:bg-[#2f647e]/30 dark:text-[#9acdeb] text-xs font-bold tracking-widest uppercase border border-[#2f647e]/20 mb-4 shadow-2xs">
                Concours Administrateur EPSO AD5
              </span>
              <h2 className="text-3xl font-serif font-normal tracking-tight text-[#191c1f] dark:text-white sm:text-4xl lg:text-5xl mb-4 leading-tight">
                Préparation Épreuves AD5
              </h2>
              <p className="text-base sm:text-lg text-[#41484c] dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
                Entraînez-vous sur les épreuves clés (Raisonnement cognitif, Connaissance de l'UE, DigComp, Anglais) avec fiches synthétiques et générateur IA sur vos documents.
              </p>
            </div>

            <div className="flex items-center justify-center max-w-3xl mx-auto bg-[#eceef1] dark:bg-slate-900/90 p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 mb-8 overflow-x-auto hide-scrollbar gap-1.5 shadow-2xs">
              {[
                { id: 'dashboard', label: 'Accueil' },
                { id: 'qcm', label: 'QCM EPSO AD5' },
                { id: 'english', label: "Programme d'Anglais" },
                { id: 'fact_sheets', label: 'Fiches Thématiques' },
                { id: 'library', label: 'Bibliothèque' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={cn(
                    "flex-1 sm:flex-initial text-center justify-center px-5 py-2.5 text-xs font-bold whitespace-nowrap rounded-xl transition-all cursor-pointer border tracking-wide",
                    activeTab === tab.id
                      ? "bg-white dark:bg-slate-800 text-[#2f647e] dark:text-[#76a9c5] border-[#2f647e]/30 dark:border-slate-700 shadow-sm font-extrabold"
                      : "text-[#41484c] dark:text-slate-400 border-transparent hover:text-[#191c1f] dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/50"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="mb-12">
              {activeTab === 'qcm' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
                        <Calculator className="w-6 h-6 text-blue-500" />
                        Tests QCM EPSO AD5
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Générez un test sur-mesure pour chaque épreuve en choisissant votre niveau.</p>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 p-2 rounded-xl">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Langue :</span>
                        <div className="flex bg-white dark:bg-slate-700 rounded-lg p-1 shadow-sm border border-slate-200 dark:border-slate-600">
                          <button
                            onClick={() => setQuestionLanguage('fr')}
                            className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${questionLanguage === 'fr' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'}`}
                          >
                            FR
                          </button>
                          <button
                            onClick={() => setQuestionLanguage('en')}
                            className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${questionLanguage === 'en' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'}`}
                          >
                            EN
                          </button>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 p-2 rounded-xl">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Nombre :</span>
                        <div className="flex items-center gap-2 bg-white dark:bg-slate-700 rounded-lg px-2 py-1 shadow-sm border border-slate-200 dark:border-slate-600">
                          <input 
                            type="range" 
                            min="1" 
                            max="10" 
                            value={questionCount} 
                            onChange={(e) => setQuestionCount(parseInt(e.target.value))}
                            className="w-24 accent-blue-600"
                          />
                          <span className="text-sm font-bold w-4 text-center text-blue-600 dark:text-blue-400">{questionCount}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex border-b border-slate-200 dark:border-slate-800 mb-6 overflow-x-auto hide-scrollbar">
                    <button onClick={() => setActiveQcmTab('numerical')} className={`px-4 py-3 font-medium text-sm whitespace-nowrap border-b-2 transition-colors ${activeQcmTab === 'numerical' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}>Raisonnement Numérique</button>
                    <button onClick={() => setActiveQcmTab('verbal')} className={`px-4 py-3 font-medium text-sm whitespace-nowrap border-b-2 transition-colors ${activeQcmTab === 'verbal' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}>Raisonnement Verbal</button>
                    <button onClick={() => setActiveQcmTab('eu')} className={`px-4 py-3 font-medium text-sm whitespace-nowrap border-b-2 transition-colors ${activeQcmTab === 'eu' ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}>Connaissance de l'UE</button>
                    <button onClick={() => setActiveQcmTab('digcomp')} className={`px-4 py-3 font-medium text-sm whitespace-nowrap border-b-2 transition-colors ${activeQcmTab === 'digcomp' ? 'border-purple-600 text-purple-600 dark:text-purple-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}>DigComp 2.2</button>
                    <button onClick={() => setActiveQcmTab('cognitive')} className={`px-4 py-3 font-medium text-sm whitespace-nowrap border-b-2 transition-colors ${activeQcmTab === 'cognitive' ? 'border-pink-600 text-pink-600 dark:text-pink-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}>Raisonnement Cognitif (QI)</button>
                  </div>
                  
                  <div className="flex flex-col gap-3">
                    {activeQcmTab === 'numerical' && NUMERICAL_TYPES.map(type => {
                      const testId = `num_${type.id}`;
                      const currentDiff = testDifficulties[testId] || 'moyen';
                      return (
                        <div key={testId} className="animate-in fade-in flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                          <div className="flex items-center gap-4 mb-4 sm:mb-0">
                            <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center shrink-0">
                              <Calculator className="w-6 h-6" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-slate-800 dark:text-slate-200">Raisonnement Numérique - {type.label}</h4>
                              <p className="text-sm text-slate-500 dark:text-slate-400">Calculs, tableaux et résolution de problèmes logiques.</p>
                            </div>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-4">
                            <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                              {(['facile', 'moyen', 'difficile'] as const).map(level => (
                                <button 
                                  key={level}
                                  onClick={() => setTestDifficulties(prev => ({ ...prev, [testId]: level }))}
                                  className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${currentDiff === level ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'}`}
                                >
                                  {level}
                                </button>
                              ))}
                            </div>
                            <button 
                              onClick={() => generateQuizWithoutDocument('numerical', type.id, currentDiff, questionCount)}
                              className="px-4 py-2 bg-blue-600 text-white font-medium text-sm rounded-xl hover:bg-blue-700 transition-colors shrink-0"
                            >
                              Démarrer
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {activeQcmTab === 'verbal' && (
                    <div className="animate-in fade-in flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
                      <div className="flex items-center gap-4 mb-4 sm:mb-0">
                        <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center shrink-0">
                          <FileText className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-slate-800 dark:text-slate-200">Raisonnement Verbal</h4>
                          <p className="text-sm text-slate-500 dark:text-slate-400">Compréhension de textes et déduction logique.</p>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                          {(['facile', 'moyen', 'difficile'] as const).map(level => (
                            <button 
                              key={level}
                              onClick={() => setTestDifficulties(prev => ({ ...prev, verbal: level }))}
                              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${(testDifficulties.verbal || 'moyen') === level ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'}`}
                            >
                              {level}
                            </button>
                          ))}
                        </div>
                        <button 
                          onClick={() => generateQuizWithoutDocument('verbal', undefined, testDifficulties.verbal || 'moyen', questionCount)}
                          className="px-4 py-2 bg-indigo-600 text-white font-medium text-sm rounded-xl hover:bg-indigo-700 transition-colors shrink-0"
                        >
                          Démarrer
                        </button>
                      </div>
                    </div>
                    )}

                    {activeQcmTab === 'eu' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                      {/* Source Selection Header */}
                      <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-indigo-500/10 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-indigo-950/30 border border-emerald-200/80 dark:border-emerald-800/50 rounded-3xl p-6 shadow-sm">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-md">
                              <Globe className="w-6 h-6" />
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-900 dark:text-white text-lg flex items-center gap-2">
                                QCM Connaissance UE sur Mes Documents
                              </h4>
                              <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
                                Génération automatique de QCMs thématiques (Dates, Institutions, Politiques, Histoire, Traités, Chiffres) extraits à 100% de vos documents PDF.
                              </p>
                            </div>
                          </div>

                          {/* Source selector */}
                          {libraryDocuments.length > 0 && (
                            <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm shrink-0 flex flex-col gap-2 min-w-[280px]">
                              <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                  <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                  Périmètre RAG :
                                </label>
                                <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
                                  <button
                                    onClick={() => setQcmSourceMode('all_docs')}
                                    className={cn("px-2 py-0.5 text-[10px] font-bold rounded", qcmSourceMode === 'all_docs' ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs" : "text-slate-500")}
                                  >
                                    Tout
                                  </button>
                                  {libraryFolders.length > 0 && (
                                    <button
                                      onClick={() => setQcmSourceMode('folder')}
                                      className={cn("px-2 py-0.5 text-[10px] font-bold rounded", qcmSourceMode === 'folder' ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs" : "text-slate-500")}
                                    >
                                      Dossier
                                    </button>
                                  )}
                                  <button
                                    onClick={() => setQcmSourceMode('single_doc')}
                                    className={cn("px-2 py-0.5 text-[10px] font-bold rounded", qcmSourceMode === 'single_doc' ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs" : "text-slate-500")}
                                  >
                                    Doc
                                  </button>
                                </div>
                              </div>

                              {qcmSourceMode === 'all_docs' && (
                                <div className="bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                                  Toute la base ({libraryDocuments.length} documents)
                                </div>
                              )}

                              {qcmSourceMode === 'folder' && (
                                <select
                                  value={qcmSourceFolderId || ''}
                                  onChange={(e) => setQcmSourceFolderId(e.target.value || null)}
                                  className="bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                                >
                                  <option value="">Sélectionner un dossier...</option>
                                  {renderFolderSelectOptions(null, 0)}
                                </select>
                              )}

                              {qcmSourceMode === 'single_doc' && (
                                <select
                                  value={selectedEuDocId}
                                  onChange={(e) => setSelectedEuDocId(e.target.value)}
                                  className="bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                                >
                                  {libraryDocuments.map(doc => (
                                    <option key={doc.id} value={doc.id}>{doc.name}</option>
                                  ))}
                                </select>
                              )}
                            </div>
                          )}
                        </div>

                        {libraryDocuments.length === 0 ? (
                          <div className="mt-4 pt-4 border-t border-emerald-200/60 dark:border-emerald-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-emerald-50/80 dark:bg-emerald-950/50 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-800">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center shrink-0">
                                <UploadCloud className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-900 dark:text-white">
                                  Veuillez uploader vos documents PDF de cours
                                </p>
                                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                                  Pour générer des QCMs sur les dates, politiques, institutions, histoire et chiffres, vous devez uploader vos fichiers.
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setAppState('UPLOAD');
                                setActiveTab('library');
                              }}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all shrink-0 flex items-center gap-1.5"
                            >
                              <UploadCloud className="w-4 h-4" />
                              Uploader un PDF
                            </button>
                          </div>
                        ) : (
                          <div className="mt-3 pt-3 border-t border-emerald-200/60 dark:border-emerald-800/40 text-xs text-emerald-800 dark:text-emerald-300 font-medium">
                            {qcmSourceMode === 'all_docs' && (
                              <span>Extractions RAG : <strong>Questions générées sur l'ensemble de vos {libraryDocuments.length} document(s)</strong>.</span>
                            )}
                            {qcmSourceMode === 'folder' && (
                              <span>Extractions RAG : <strong>Questions générées à partir du dossier "{libraryFolders.find(f => f.id === qcmSourceFolderId)?.name || 'sélectionné'}"</strong>.</span>
                            )}
                            {qcmSourceMode === 'single_doc' && (
                              <span>Extractions RAG : <strong>Questions générées uniquement depuis "{libraryDocuments.find(d => d.id === selectedEuDocId)?.name}"</strong>.</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Thematic Cards Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {EU_SUBTYPES.map(subType => {
                          const testId = `eu_${subType.id}`;
                          const currentDiff = testDifficulties[testId] || 'moyen';
                          const IconComponent = subType.icon;

                          return (
                            <div
                              key={subType.id}
                              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-700 transition-all flex flex-col justify-between group"
                            >
                              <div>
                                <div className="flex items-start justify-between gap-3 mb-3">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                      <IconComponent className="w-5 h-5" />
                                    </div>
                                    <div>
                                      <h5 className="font-bold text-slate-900 dark:text-white text-base">
                                        {subType.title}
                                      </h5>
                                      <span className="inline-block px-2 py-0.5 bg-emerald-100/70 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 rounded text-[10px] font-bold uppercase tracking-wider mt-0.5">
                                        {subType.badge}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
                                  {subType.description}
                                </p>
                              </div>

                              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                                <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
                                  {(['facile', 'moyen', 'difficile'] as const).map(level => (
                                    <button
                                      key={level}
                                      onClick={() => setTestDifficulties(prev => ({ ...prev, [testId]: level }))}
                                      className={cn(
                                        "px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-all",
                                        currentDiff === level
                                          ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm"
                                          : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                                      )}
                                    >
                                      {level}
                                    </button>
                                  ))}
                                </div>

                                <button
                                  onClick={() => generateEuQuiz(subType.id as any, currentDiff)}
                                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5 shrink-0"
                                >
                                  <Award className="w-3.5 h-3.5" />
                                  Démarrer
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    )}

                    {activeQcmTab === 'digcomp' && (
                    <div className="animate-in fade-in flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:border-purple-300 dark:hover:border-purple-700 transition-colors">
                      <div className="flex items-center gap-4 mb-4 sm:mb-0">
                        <div className="w-12 h-12 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-xl flex items-center justify-center shrink-0">
                          <Monitor className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-slate-800 dark:text-slate-200">DigComp 2.2</h4>
                          <p className="text-sm text-slate-500 dark:text-slate-400">Évaluation des compétences et connaissances numériques.</p>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                          {(['facile', 'moyen', 'difficile'] as const).map(level => (
                            <button 
                              key={level}
                              onClick={() => setTestDifficulties(prev => ({ ...prev, digcomp: level }))}
                              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${(testDifficulties.digcomp || 'moyen') === level ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'}`}
                            >
                              {level}
                            </button>
                          ))}
                        </div>
                        <button 
                          onClick={() => generateQuizWithoutDocument('digcomp', undefined, testDifficulties.digcomp || 'moyen', questionCount)}
                          className="px-4 py-2 bg-purple-600 text-white font-medium text-sm rounded-xl hover:bg-purple-700 transition-colors shrink-0"
                        >
                          Démarrer
                        </button>
                      </div>
                    </div>
                    )}

                    {activeQcmTab === 'cognitive' && (
                    <div className="animate-in fade-in flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:border-pink-300 dark:hover:border-pink-700 transition-colors">
                      <div className="flex items-center gap-4 mb-4 sm:mb-0">
                        <div className="w-12 h-12 bg-pink-50 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 rounded-xl flex items-center justify-center shrink-0">
                          <BrainCircuit className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-slate-800 dark:text-slate-200">Raisonnement Cognitif (QI)</h4>
                          <p className="text-sm text-slate-500 dark:text-slate-400">Suites logiques, déduction et puzzles de type EPSO Abstract Reasoning.</p>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                          {(['facile', 'moyen', 'difficile'] as const).map(level => (
                            <button 
                              key={level}
                              onClick={() => setTestDifficulties(prev => ({ ...prev, cognitive: level }))}
                              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${(testDifficulties.cognitive || 'moyen') === level ? 'bg-white dark:bg-slate-700 text-pink-600 dark:text-pink-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'}`}
                            >
                              {level}
                            </button>
                          ))}
                        </div>
                        <button 
                          onClick={() => generateQuizWithoutDocument('cognitive', undefined, testDifficulties.cognitive || 'moyen', questionCount)}
                          className="px-4 py-2 bg-pink-600 text-white font-medium text-sm rounded-xl hover:bg-pink-700 transition-colors shrink-0"
                        >
                          Démarrer
                        </button>
                      </div>
                    </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'english' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
                        <Globe className="w-6 h-6 text-indigo-500" />
                        Programme d'Anglais (EUFTE)
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Entraînez-vous pour les épreuves de compétences linguistiques en anglais.</p>
                    </div>
                    
                    <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 p-2 rounded-xl">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Nombre de questions :</span>
                      <div className="flex items-center gap-2 bg-white dark:bg-slate-700 rounded-lg px-2 py-1 shadow-sm border border-slate-200 dark:border-slate-600">
                        <input 
                          type="range" 
                          min="1" 
                          max="10" 
                          value={questionCount} 
                          onChange={(e) => setQuestionCount(parseInt(e.target.value))}
                          className="w-24 accent-indigo-600"
                        />
                        <span className="text-sm font-bold w-4 text-center text-indigo-600 dark:text-indigo-400">{questionCount}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid sm:grid-cols-3 gap-4">
                    {ENGLISH_TYPES.map(type => (
                      <button
                        key={type.id}
                        onClick={() => generateQuizWithoutDocument('english', type.id, undefined, questionCount)}
                        className="flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 transition-all text-slate-700 dark:text-slate-300 shadow-sm group"
                      >
                        <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                          {type.id === 'essay' ? <BookOpen className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                        </div>
                        <span className="font-semibold text-center">{type.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'fact_sheets' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex flex-col mb-6 gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
                          <FileText className="w-6 h-6 text-amber-500" />
                          Fiches Thématiques UE & Flashcards
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Générez des fiches de révision ou des flashcards (connaissances générales ou ciblées sur vos PDF).</p>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 p-2 rounded-xl">
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Langue :</span>
                          <div className="flex bg-white dark:bg-slate-700 rounded-lg p-1 shadow-sm border border-slate-200 dark:border-slate-600">
                            <button
                              onClick={() => setQuestionLanguage('fr')}
                              className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${questionLanguage === 'fr' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'}`}
                            >
                              FR
                            </button>
                            <button
                              onClick={() => setQuestionLanguage('en')}
                              className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${questionLanguage === 'en' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'}`}
                            >
                              EN
                            </button>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 p-2 rounded-xl">
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Périmètre RAG :</span>
                          <div className="flex bg-white dark:bg-slate-700 rounded-lg p-1 shadow-sm border border-slate-200 dark:border-slate-600">
                            <button
                              onClick={() => setFactSheetSourceMode('all_docs')}
                              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${factSheetSourceMode === 'all_docs' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' : 'text-slate-500'}`}
                            >
                              Toute la base
                            </button>
                            {libraryFolders.length > 0 && (
                              <button
                                onClick={() => setFactSheetSourceMode('folder')}
                                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${factSheetSourceMode === 'folder' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' : 'text-slate-500'}`}
                              >
                                Dossier
                              </button>
                            )}
                            <button
                              onClick={() => setFactSheetSourceMode('single_doc')}
                              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${factSheetSourceMode === 'single_doc' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' : 'text-slate-500'}`}
                            >
                              Document
                            </button>
                          </div>

                          {factSheetSourceMode === 'folder' && (
                            <select
                              value={factSheetSourceFolderId || ''}
                              onChange={(e) => setFactSheetSourceFolderId(e.target.value || null)}
                              className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1 outline-none text-xs font-medium text-slate-700 dark:text-slate-300 max-w-[180px] truncate"
                            >
                              <option value="">Sélectionner dossier...</option>
                              {renderFolderSelectOptions(null, 0)}
                            </select>
                          )}

                          {factSheetSourceMode === 'single_doc' && (
                            <select
                              value={selectedFactSheetDocId}
                              onChange={(e) => setSelectedFactSheetDocId(e.target.value)}
                              className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1 outline-none text-xs font-medium text-slate-700 dark:text-slate-300 max-w-[180px] truncate"
                            >
                              <option value="">Aucun (IA sans PDF)</option>
                              {libraryDocuments.map(doc => (
                                <option key={doc.id} value={doc.id}>{doc.name}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
                    </div>

                    {factSheetSourceMode === 'single_doc' && selectedFactSheetDocId && (() => {
                      const selectedDoc = libraryDocuments.find(d => d.id === selectedFactSheetDocId);
                      return (
                        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-sm bg-amber-50/50 dark:bg-amber-950/20 p-3 rounded-xl border border-amber-200/50 dark:border-amber-800/30">
                          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-medium">
                            <FileText className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>Filtre RAG Document : <strong className="text-slate-900 dark:text-white">{selectedDoc?.name}</strong></span>
                            {selectedDoc?.numPages ? (
                              <span className="text-xs text-amber-700/80 dark:text-amber-400">({selectedDoc.numPages} page{selectedDoc.numPages > 1 ? 's' : ''} au total)</span>
                            ) : null}
                          </div>
                          
                          {selectedDoc?.type === 'pdf' && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Plage de pages à traiter :</span>
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-slate-500">Page</span>
                                <input
                                  type="number"
                                  min={1}
                                  max={selectedDoc.numPages || 999}
                                  value={factSheetPageStart}
                                  onChange={(e) => setFactSheetPageStart(Math.max(1, parseInt(e.target.value) || 1))}
                                  className="w-14 px-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-xs font-bold text-center text-slate-900 dark:text-white"
                                />
                                <span className="text-xs text-slate-500">à</span>
                                <input
                                  type="number"
                                  min={factSheetPageStart}
                                  max={selectedDoc.numPages || 999}
                                  value={factSheetPageEnd}
                                  onChange={(e) => setFactSheetPageEnd(Math.max(factSheetPageStart, parseInt(e.target.value) || factSheetPageStart))}
                                  className="w-14 px-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-xs font-bold text-center text-slate-900 dark:text-white"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                  
                  <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-3">Générer une Fiche de Révision détaillée</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
                    {FACT_SHEET_TOPICS.map(type => (
                      <button
                        key={type.id}
                        onClick={() => generateFactSheet(type.id)}
                        className="text-left p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl hover:border-amber-500 hover:bg-amber-50/50 dark:hover:bg-amber-900/20 transition-all font-semibold text-slate-700 dark:text-slate-300 shadow-sm"
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>

                  <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                    <Layers className="w-5 h-5 text-blue-500" />
                    Générer un Paquet de Flashcards (Concepts & Définitions)
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-10">
                    {FACT_SHEET_TOPICS.map(type => (
                      <button
                        key={`flashcard-${type.id}`}
                        onClick={() => generateFlashcards(type.id)}
                        className="text-left p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-all font-semibold text-slate-700 dark:text-slate-300 shadow-sm flex items-center justify-between group"
                      >
                        {type.label}
                        <Layers className="w-5 h-5 text-slate-300 dark:text-slate-600 group-hover:text-blue-500 transition-colors" />
                      </button>
                    ))}
                  </div>

                  {/* Saved Fiches & Flashcards Sections */}
                  {savedFactSheets.length > 0 && (
                    <div className="mt-8 pt-8 border-t border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-2 mb-4">
                        <BookOpenCheck className="w-5 h-5 text-emerald-500" />
                        <h4 className="font-bold text-slate-900 dark:text-white text-lg">
                          Mes Fiches de Révision enregistrées ({savedFactSheets.length})
                        </h4>
                      </div>
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                        {savedFactSheets.map(sheet => (
                          <div key={sheet.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm hover:shadow-md transition-shadow group flex flex-col justify-between">
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <span className="bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1">
                                  <FileText className="w-3.5 h-3.5" />
                                  {sheet.concepts?.length || 0} notions
                                </span>
                                <button
                                  onClick={() => setSavedFactSheets(prev => prev.filter(s => s.id !== sheet.id))}
                                  className="text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                  title="Supprimer cette fiche"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                              <h5 className="font-bold text-slate-900 dark:text-white text-sm mb-1 line-clamp-2" title={sheet.title}>
                                {sheet.title}
                              </h5>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                                Enregistrée le {new Date(sheet.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            <button
                              onClick={() => {
                                setFactSheetContent(sheet);
                                setAppState('FACT_SHEET');
                              }}
                              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                            >
                              <BookOpenCheck className="w-4 h-4" />
                              Consulter la fiche
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {savedFlashcards.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-2 mb-4">
                        <Layers className="w-5 h-5 text-blue-500" />
                        <h4 className="font-bold text-slate-900 dark:text-white text-lg">
                          Mes Paquets de Flashcards enregistrés ({savedFlashcards.length})
                        </h4>
                      </div>
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {savedFlashcards.map(deck => (
                          <div key={deck.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm hover:shadow-md transition-shadow group flex flex-col justify-between">
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <span className="bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1">
                                  <Layers className="w-3.5 h-3.5" />
                                  {deck.cards.length} cartes
                                </span>
                                <button
                                  onClick={() => setSavedFlashcards(prev => prev.filter(d => d.id !== deck.id))}
                                  className="text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                  title="Supprimer ce paquet"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                              <h5 className="font-bold text-slate-900 dark:text-white text-sm mb-1 line-clamp-2" title={deck.title}>
                                {deck.title}
                              </h5>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                                Enregistré le {new Date(deck.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            <button
                              onClick={() => {
                                setFlashcards(deck.cards);
                                setCurrentFlashcardIndex(0);
                                setIsFlashcardFlipped(false);
                                setAppState('FLASHCARDS');
                              }}
                              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                            >
                              <Layers className="w-4 h-4" />
                              Lancer la révision
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'library' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {/* Top Bar & Search */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Bibliothèque EPSO</h3>
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Gérez vos documents sources importés et l'ensemble de vos contenus et questions générés par l'IA.
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="relative flex-1 md:w-64">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Search className="h-4 w-4 text-slate-400" />
                        </div>
                        <input
                          type="text"
                          placeholder="Rechercher..."
                          value={librarySearchQuery}
                          onChange={(e) => setLibrarySearchQuery(e.target.value)}
                          className="pl-10 pr-4 py-2 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                        />
                      </div>
                      
                      <label className="cursor-pointer inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-medium transition-colors shadow-sm text-sm shrink-0">
                        <UploadCloud className="w-4 h-4" />
                        <span className="hidden sm:inline">Ajouter un document</span>
                        <input
                          type="file"
                          accept=".pdf,.docx,.txt"
                          className="sr-only"
                          onChange={handleLibraryUpload}
                          ref={libraryFileInputRef}
                        />
                      </label>
                    </div>
                  </div>

                  {/* Primary Section Switcher */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 p-1.5 bg-slate-200/80 dark:bg-slate-800/90 rounded-2xl border border-slate-300 dark:border-slate-700/80 mb-8 gap-2 shadow-xs">
                    <button
                      onClick={() => setLibrarySection('documents')}
                      className={cn(
                        "py-3.5 px-5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2.5 cursor-pointer border",
                        librarySection === 'documents'
                          ? "bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 border-slate-300 dark:border-slate-700 shadow-md ring-1 ring-slate-200 dark:ring-slate-800"
                          : "text-slate-700 dark:text-slate-300 border-transparent hover:bg-slate-300/60 dark:hover:bg-slate-700/60"
                      )}
                    >
                      <FileText className="w-4.5 h-4.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <span>Documents Source</span>
                      <span className={cn(
                        "px-2.5 py-0.5 rounded-full text-xs font-extrabold border ml-1",
                        librarySection === 'documents'
                          ? "bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-200 border-indigo-300 dark:border-indigo-800"
                          : "bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-200 border-slate-400 dark:border-slate-600"
                      )}>
                        {libraryDocuments.length}
                      </span>
                    </button>
                    <button
                      onClick={() => setLibrarySection('generated')}
                      className={cn(
                        "py-3.5 px-5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2.5 cursor-pointer border",
                        librarySection === 'generated'
                          ? "bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 border-slate-300 dark:border-slate-700 shadow-md ring-1 ring-slate-200 dark:ring-slate-800"
                          : "text-slate-700 dark:text-slate-300 border-transparent hover:bg-slate-300/60 dark:hover:bg-slate-700/60"
                      )}
                    >
                      <BrainCircuit className="w-4.5 h-4.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <span>Contenus & Questions Générés</span>
                      <span className={cn(
                        "px-2.5 py-0.5 rounded-full text-xs font-extrabold border ml-1",
                        librarySection === 'generated'
                          ? "bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-200 border-indigo-300 dark:border-indigo-800"
                          : "bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-200 border-slate-400 dark:border-slate-600"
                      )}>
                        {savedQuizzes.length + savedDocAnalyses.length + savedFactSheets.length + savedFlashcards.length}
                      </span>
                    </button>
                  </div>

                  {/* SECTION 1: DOCUMENTS SOURCE */}
                  {librarySection === 'documents' && (
                    <div>
                      {/* Notification Toast */}
                      {libraryNotification && (
                        <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-2xl text-xs font-bold flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2">
                          <span>{libraryNotification}</span>
                          <button onClick={() => setLibraryNotification(null)} className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-100 p-1 cursor-pointer">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      {/* Folder Toolbar & Breadcrumbs with Drop Targets */}
                      <div className="bg-slate-100/90 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700/90 rounded-2xl p-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        {/* Breadcrumbs */}
                        <div className="flex items-center flex-wrap gap-1.5 text-sm font-semibold">
                          <button
                            onClick={() => setCurrentFolderId(null)}
                            onDragOver={(e) => { e.preventDefault(); setDragOverFolderId('root'); }}
                            onDragLeave={() => { if (dragOverFolderId === 'root') setDragOverFolderId(null); }}
                            onDrop={(e) => {
                              e.preventDefault();
                              const docId = e.dataTransfer.getData('text/plain');
                              if (docId) moveDocumentsToFolder([docId], null);
                              setDragOverFolderId(null);
                              setDraggedDocId(null);
                            }}
                            className={cn(
                              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer border",
                              currentFolderId === null
                                ? "bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800 font-bold shadow-xs"
                                : "text-slate-700 dark:text-slate-300 border-transparent hover:bg-slate-200 dark:hover:bg-slate-700",
                              dragOverFolderId === 'root' && "ring-2 ring-emerald-500 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 scale-105"
                            )}
                          >
                            <Home className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                            <span>Racine</span>
                            {dragOverFolderId === 'root' && <span className="text-[10px] ml-1 font-extrabold text-emerald-600 dark:text-emerald-400">Déposer ici</span>}
                          </button>

                          {getFolderPathBreadcrumbs(currentFolderId).map((f) => (
                            <React.Fragment key={f.id}>
                              <ChevronRight className="w-4 h-4 text-slate-400" />
                              <button
                                onClick={() => setCurrentFolderId(f.id)}
                                onDragOver={(e) => { e.preventDefault(); setDragOverFolderId(f.id); }}
                                onDragLeave={() => { if (dragOverFolderId === f.id) setDragOverFolderId(null); }}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  const docId = e.dataTransfer.getData('text/plain');
                                  if (docId) moveDocumentsToFolder([docId], f.id);
                                  setDragOverFolderId(null);
                                  setDraggedDocId(null);
                                }}
                                className={cn(
                                  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer border",
                                  f.id === currentFolderId
                                    ? "bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800 font-bold shadow-xs"
                                    : "text-slate-700 dark:text-slate-300 border-transparent hover:bg-slate-200 dark:hover:bg-slate-700",
                                  dragOverFolderId === f.id && "ring-2 ring-indigo-500 bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-200 scale-105"
                                )}
                              >
                                <Folder className="w-4 h-4 text-indigo-500" />
                                <span>{f.name}</span>
                                {dragOverFolderId === f.id && <span className="text-[10px] ml-1 font-extrabold text-indigo-600 dark:text-indigo-400">Déposer ici</span>}
                              </button>
                            </React.Fragment>
                          ))}
                        </div>

                        {/* Create Folder Button */}
                        <button
                          onClick={() => {
                            setNewFolderName('');
                            setIsCreateFolderModalOpen(true);
                          }}
                          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                        >
                          <FolderPlus className="w-4 h-4" />
                          <span>Nouveau Dossier</span>
                        </button>
                      </div>

                      {/* Modal Create Folder */}
                      {isCreateFolderModalOpen && (
                        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-xl animate-in zoom-in-95">
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <FolderPlus className="w-5 h-5 text-indigo-600" />
                                Créer un dossier
                              </h4>
                              <button
                                onClick={() => setIsCreateFolderModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                              {currentFolderId
                                ? `Le sous-dossier sera créé dans "${libraryFolders.find(f => f.id === currentFolderId)?.name}".`
                                : "Le dossier sera créé à la racine."}
                            </p>
                            <input
                              type="text"
                              placeholder="Nom du dossier (ex: Droit UE, Concurrence, Fiches Concours...)"
                              value={newFolderName}
                              onChange={(e) => setNewFolderName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCreateFolder();
                              }}
                              autoFocus
                              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium mb-6 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                            />
                            <div className="flex items-center justify-end gap-3">
                              <button
                                onClick={() => setIsCreateFolderModalOpen(false)}
                                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                              >
                                Annuler
                              </button>
                              <button
                                onClick={handleCreateFolder}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                              >
                                Créer
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Modal Move Document(s) */}
                      {moveModalDocIds !== null && (
                        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl animate-in zoom-in-95 max-h-[85vh] flex flex-col">
                            <div className="flex items-center justify-between mb-4">
                              <div>
                                <h4 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                  <FolderInput className="w-5 h-5 text-indigo-600" />
                                  Déplacer dans un dossier
                                </h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                  Sélectionnez le dossier de destination pour {moveModalDocIds.length} document(s).
                                </p>
                              </div>
                              <button
                                onClick={() => setMoveModalDocIds(null)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>

                            <div className="overflow-y-auto pr-1 flex-1 my-2">
                              {/* Option Root */}
                              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/40 transition-all mb-3">
                                <div className="flex items-center gap-2.5">
                                  <Home className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                  <div>
                                    <span className="text-xs font-bold text-slate-900 dark:text-white block">
                                      Racine (Aucun dossier)
                                    </span>
                                    <span className="text-[10px] text-slate-500">
                                      Placer les documents au niveau principal
                                    </span>
                                  </div>
                                </div>
                                <button
                                  onClick={() => moveDocumentsToFolder(moveModalDocIds, null)}
                                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-lg transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
                                >
                                  <FolderInput className="w-3.5 h-3.5" />
                                  Déplacer ici
                                </button>
                              </div>

                              {libraryFolders.length === 0 ? (
                                <div className="text-center py-6 text-slate-500 text-xs bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                                  Aucun dossier créé pour le moment. Créez-en un d'abord via "Nouveau Dossier".
                                </div>
                              ) : (
                                renderFolderMoveTree(moveModalDocIds, null, 0)
                              )}
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                              <button
                                onClick={() => setMoveModalDocIds(null)}
                                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                              >
                                Annuler
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Sub-Folders Grid */}
                      {(() => {
                        const currentSubFolders = libraryFolders.filter(f => (f.parentId || null) === currentFolderId);
                        if (currentSubFolders.length === 0) return null;

                        return (
                          <div className="mb-8">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
                              <Folder className="w-4 h-4 text-indigo-500" />
                              Dossiers ({currentSubFolders.length})
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                              {currentSubFolders.map((folder) => {
                                const docCount = getFolderDocumentCount(folder.id);

                                return (
                                  <div
                                    key={folder.id}
                                    onDragOver={(e) => { e.preventDefault(); setDragOverFolderId(folder.id); }}
                                    onDragLeave={() => { if (dragOverFolderId === folder.id) setDragOverFolderId(null); }}
                                    onDrop={(e) => {
                                      e.preventDefault();
                                      const docId = e.dataTransfer.getData('text/plain');
                                      if (docId) moveDocumentsToFolder([docId], folder.id);
                                      setDragOverFolderId(null);
                                      setDraggedDocId(null);
                                    }}
                                    className={cn(
                                      "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 p-4 rounded-2xl shadow-sm hover:shadow-md transition-all group flex flex-col justify-between cursor-pointer relative",
                                      dragOverFolderId === folder.id && "border-2 border-indigo-500 ring-4 ring-indigo-500/20 bg-indigo-50/80 dark:bg-indigo-950/80 scale-102"
                                    )}
                                  >
                                    <div
                                      onClick={() => setCurrentFolderId(folder.id)}
                                      className="cursor-pointer"
                                    >
                                      <div className="flex items-center justify-between mb-3">
                                        <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center">
                                          <Folder className="w-5 h-5 fill-indigo-500/20" />
                                        </div>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (confirm(`Voulez-vous vraiment supprimer le dossier "${folder.name}" ?`)) {
                                              handleDeleteFolder(folder.id);
                                            }
                                          }}
                                          className="text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-1"
                                          title="Supprimer ce dossier"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                      <h5 className="font-bold text-slate-900 dark:text-white text-sm line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                        {folder.name}
                                      </h5>
                                      <div className="flex items-center justify-between mt-1">
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                          {docCount} document{docCount > 1 ? 's' : ''}
                                        </p>
                                        {dragOverFolderId === folder.id && (
                                          <span className="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400 animate-pulse">
                                            Glisser ici
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Documents Section */}
                      {(() => {
                        let filteredDocs = libraryDocuments;
                        
                        if (librarySearchQuery.trim().length > 0) {
                          filteredDocs = libraryDocuments.filter(doc => doc.name.toLowerCase().includes(librarySearchQuery.toLowerCase()));
                        } else {
                          filteredDocs = libraryDocuments.filter(doc => (doc.folderId || null) === currentFolderId);
                        }

                        if (filteredDocs.length === 0) {
                          return (
                            <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 border-dashed p-8">
                              <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <FileText className="w-7 h-7" />
                              </div>
                              <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                                {currentFolderId ? "Ce dossier ne contient aucun document" : "Aucun document à la racine"}
                              </h4>
                              <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6 text-xs">
                                Uploadez vos fichiers PDF, Word (.docx) ou texte (.txt) ou déplacez des documents existants dans ce dossier.
                              </p>
                              <label className="cursor-pointer inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-semibold transition-colors shadow-sm text-xs">
                                <UploadCloud className="w-4 h-4" />
                                Uploader un document
                                <input
                                  type="file"
                                  accept=".pdf,.docx,.txt"
                                  className="sr-only"
                                  onChange={handleLibraryUpload}
                                />
                              </label>
                            </div>
                          );
                        }

                        return (
                          <div>
                            {/* Batch Action Toolbar when items selected */}
                            {selectedDocIdsForMove.length > 0 && (
                              <div className="mb-6 p-4 bg-indigo-50/90 dark:bg-indigo-950/90 border border-indigo-200 dark:border-indigo-800 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-sm animate-in fade-in slide-in-from-top-2">
                                <div className="flex items-center gap-2">
                                  <CheckCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                  <span className="text-sm font-bold text-indigo-900 dark:text-indigo-100">
                                    {selectedDocIdsForMove.length} document(s) sélectionné(s)
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <button
                                    onClick={() => setMoveModalDocIds(selectedDocIdsForMove)}
                                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <FolderInput className="w-4 h-4" />
                                    <span>Déplacer vers un dossier...</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (confirm(`Voulez-vous vraiment supprimer ces ${selectedDocIdsForMove.length} documents ?`)) {
                                        setLibraryDocuments(prev => prev.filter(d => !selectedDocIdsForMove.includes(d.id)));
                                        setSelectedDocIdsForMove([]);
                                      }
                                    }}
                                    className="px-3.5 py-2 bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/80 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    <span>Supprimer</span>
                                  </button>
                                  <button
                                    onClick={() => setSelectedDocIdsForMove([])}
                                    className="px-3 py-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-bold text-xs rounded-xl transition-all cursor-pointer"
                                  >
                                    Désélectionner tout
                                  </button>
                                </div>
                              </div>
                            )}

                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                <FileText className="w-4 h-4 text-indigo-500" />
                                Documents ({filteredDocs.length})
                              </h4>

                              <button
                                onClick={() => {
                                  if (selectedDocIdsForMove.length === filteredDocs.length) {
                                    setSelectedDocIdsForMove([]);
                                  } else {
                                    setSelectedDocIdsForMove(filteredDocs.map(d => d.id));
                                  }
                                }}
                                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                              >
                                {selectedDocIdsForMove.length === filteredDocs.length ? "Tout désélectionner" : "Tout sélectionner"}
                              </button>
                            </div>

                            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                              {filteredDocs.map(doc => (
                                <div
                                  key={doc.id}
                                  draggable={true}
                                  onDragStart={(e) => {
                                    e.dataTransfer.setData('text/plain', doc.id);
                                    setDraggedDocId(doc.id);
                                  }}
                                  onDragEnd={() => {
                                    setDraggedDocId(null);
                                    setDragOverFolderId(null);
                                  }}
                                  className={cn(
                                    "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all group flex flex-col relative",
                                    draggedDocId === doc.id && "opacity-40 border-dashed border-indigo-500 scale-95",
                                    selectedDocIdsForMove.includes(doc.id) && "ring-2 ring-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20"
                                  )}
                                >
                                  <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        checked={selectedDocIdsForMove.includes(doc.id)}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setSelectedDocIdsForMove(prev => [...prev, doc.id]);
                                          } else {
                                            setSelectedDocIdsForMove(prev => prev.filter(id => id !== doc.id));
                                          }
                                        }}
                                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                      />
                                      <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 cursor-grab active:cursor-grabbing" title="Glisser-déposer le document vers un dossier">
                                        <FileText className="w-5 h-5" />
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => setMoveModalDocIds([doc.id])}
                                        className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                        title="Déplacer dans un dossier"
                                      >
                                        <FolderInput className="w-4 h-4" />
                                      </button>
                                      <button 
                                        onClick={() => setLibraryDocuments(prev => prev.filter(d => d.id !== doc.id))}
                                        className="text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                        title="Supprimer"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>
                                  
                                  <h4 className="font-bold text-slate-900 dark:text-white mb-1 line-clamp-2" title={doc.name}>
                                    {doc.name}
                                  </h4>
                                  
                                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-4 flex items-center gap-2 flex-wrap">
                                    <span className="uppercase font-semibold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">{doc.type}</span>
                                    <span>•</span>
                                    <span>{doc.numPages} page{doc.numPages > 1 ? 's' : ''}</span>
                                  </div>

                                  {/* Quick Folder Assignment Action */}
                                  <div className="mb-4 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-2">
                                    <div className="flex-1 min-w-0">
                                      <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1 flex items-center gap-1">
                                        <Folder className="w-3 h-3 text-indigo-500" />
                                        Dossier :
                                      </label>
                                      <select
                                        value={doc.folderId || 'root'}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          moveDocumentToFolder(doc.id, val === 'root' ? null : val);
                                        }}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 py-1.5 px-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer truncate"
                                      >
                                        <option value="root">Racine (Aucun dossier)</option>
                                        {renderFolderSelectOptions(null, 0)}
                                      </select>
                                    </div>
                                    <button
                                      onClick={() => setMoveModalDocIds([doc.id])}
                                      className="mt-4 p-2 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-400 rounded-xl transition-colors shrink-0 cursor-pointer"
                                      title="Choisir un dossier..."
                                    >
                                      <FolderInput className="w-4 h-4" />
                                    </button>
                                  </div>
                                  
                                  <div className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                                    <a
                                      href={doc.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 py-2 rounded-xl text-xs font-semibold transition-colors text-center inline-block"
                                    >
                                      Lire
                                    </a>
                                    <button
                                      onClick={() => {
                                        setUploadedDocument(doc);
                                        setPdfPageRange({ start: 1, end: Math.min(5, doc.numPages) });
                                        setChunkMode('manual');
                                        setAppState('DOCUMENT_VIEWER');
                                      }}
                                      className="flex-1 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                                    >
                                      <BrainCircuit className="w-4 h-4" />
                                      Analyser
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* SECTION 2: CONTENUS & QUESTIONS GÉNÉRÉS */}
                  {librarySection === 'generated' && (
                    <div>
                      {/* Filter Bar with Category Pills & Folder Selector */}
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                        {/* Category Pills */}
                        <div className="flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar">
                          <button
                            onClick={() => setGeneratedFilter('all')}
                            className={cn(
                              "px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap",
                              generatedFilter === 'all'
                                ? "bg-indigo-600 text-white shadow-sm"
                                : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                            )}
                          >
                            Tous ({savedQuizzes.length + savedDocAnalyses.length + savedFactSheets.length + savedFlashcards.length})
                          </button>
                          <button
                            onClick={() => setGeneratedFilter('quizzes')}
                            className={cn(
                              "px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap flex items-center gap-1.5",
                              generatedFilter === 'quizzes'
                                ? "bg-blue-600 text-white shadow-sm"
                                : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                            )}
                          >
                            <Award className="w-3.5 h-3.5" />
                            QCM & Questions ({savedQuizzes.length})
                          </button>
                          <button
                            onClick={() => setGeneratedFilter('analyses')}
                            className={cn(
                              "px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap flex items-center gap-1.5",
                              generatedFilter === 'analyses'
                                ? "bg-amber-600 text-white shadow-sm"
                                : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                            )}
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            Analyses RAG ({savedDocAnalyses.length})
                          </button>
                          <button
                            onClick={() => setGeneratedFilter('fact_sheets')}
                            className={cn(
                              "px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap flex items-center gap-1.5",
                              generatedFilter === 'fact_sheets'
                                ? "bg-emerald-600 text-white shadow-sm"
                                : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                            )}
                          >
                            <BookOpenCheck className="w-3.5 h-3.5" />
                            Fiches de Révision ({savedFactSheets.length})
                          </button>
                          <button
                            onClick={() => setGeneratedFilter('flashcards')}
                            className={cn(
                              "px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap flex items-center gap-1.5",
                              generatedFilter === 'flashcards'
                                ? "bg-indigo-600 text-white shadow-sm"
                                : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                            )}
                          >
                            <Layers className="w-3.5 h-3.5" />
                            Flashcards ({savedFlashcards.length})
                          </button>
                        </div>

                        {/* Folder Filter Selector */}
                        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-xl shadow-xs">
                          <Folder className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 hidden sm:inline">Dossier :</span>
                          <select
                            value={generatedFolderFilter}
                            onChange={(e) => setGeneratedFolderFilter(e.target.value)}
                            className="bg-transparent border-0 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer pr-2"
                          >
                            <option value="all">Tous les dossiers</option>
                            <option value="root">Racine (Aucun dossier)</option>
                            {renderFolderSelectOptions(null, 0)}
                          </select>
                        </div>
                      </div>

                      {/* Empty state if nothing generated */}
                      {savedQuizzes.length === 0 && savedDocAnalyses.length === 0 && savedFactSheets.length === 0 && savedFlashcards.length === 0 ? (
                        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 border-dashed p-8">
                          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <BrainCircuit className="w-8 h-8" />
                          </div>
                          <h4 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Aucun contenu généré pour le moment</h4>
                          <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6 text-sm">
                            Lancez un QCM EPSO ou uploadez un document pour générer automatiquement des questions, fiches et analyses IA.
                          </p>
                          <button
                            onClick={() => setActiveTab('qcm')}
                            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-semibold transition-colors shadow-sm text-sm cursor-pointer"
                          >
                            <Calculator className="w-4 h-4" />
                            Générer mon premier QCM
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-10">
                          {/* 1. QCM & QUESTIONS GENERATED */}
                          {(generatedFilter === 'all' || generatedFilter === 'quizzes') && savedQuizzes.length > 0 && (
                            <div>
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                                <div className="flex items-center gap-2">
                                  <Award className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                  <h4 className="text-lg font-bold text-slate-900 dark:text-white">QCM & Questions Générés ({savedQuizzes.filter(q => matchesQcmSubFilter(q, qcmSubFilter) && matchesGeneratedFolderFilter(q.folderId)).length})</h4>
                                </div>

                                {/* QCM Sub-Filter Bar */}
                                <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar pb-1">
                                  {[
                                    { id: 'all', label: 'Tous' },
                                    { id: 'eu_all_knowledge', label: 'Toute Connaissance' },
                                    { id: 'eu_dates', label: 'Dates' },
                                    { id: 'eu_institutions', label: 'Institutions' },
                                    { id: 'eu_policies', label: 'Politiques' },
                                    { id: 'eu_history', label: 'Histoire' },
                                    { id: 'eu_treaties', label: 'Traités' },
                                    { id: 'eu_figures', label: 'Chiffres' },
                                    { id: 'numerical', label: 'Numérique' },
                                    { id: 'verbal', label: 'Verbal' },
                                    { id: 'digcomp', label: 'DigComp' },
                                    { id: 'english', label: 'Anglais' }
                                  ].map(f => (
                                    <button
                                      key={f.id}
                                      onClick={() => setQcmSubFilter(f.id)}
                                      className={cn(
                                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer border",
                                        qcmSubFilter === f.id
                                          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 dark:border-white shadow-xs"
                                          : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
                                      )}
                                    >
                                      {f.label}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {savedQuizzes
                                  .filter(q => q.title.toLowerCase().includes(librarySearchQuery.toLowerCase()) && matchesQcmSubFilter(q, qcmSubFilter) && matchesGeneratedFolderFilter(q.folderId))
                                  .map(quiz => (
                                    <div key={quiz.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow group flex flex-col">
                                      <div className="flex items-start justify-between mb-3 gap-2">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                                            <Award className="w-4 h-4" />
                                          </div>
                                          {getQuizCategoryBadge(quiz)}
                                          {quiz.folderName ? (
                                            <span className="bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 shrink-0">
                                              <Folder className="w-3 h-3 text-indigo-500" />
                                              {quiz.folderName}
                                            </span>
                                          ) : (
                                            <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 shrink-0">
                                              <Home className="w-3 h-3 text-slate-400" />
                                              Racine
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <button
                                            onClick={() => setMoveModalResource({ type: 'quiz', id: quiz.id, title: quiz.title })}
                                            className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors opacity-0 group-hover:opacity-100 p-1 cursor-pointer"
                                            title="Déplacer dans un dossier"
                                          >
                                            <FolderInput className="w-4 h-4" />
                                          </button>
                                          <button 
                                            onClick={(e) => deleteQuiz(quiz.id, e)}
                                            className="text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-1 cursor-pointer"
                                            title="Supprimer ce QCM"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                        </div>
                                      </div>
                                      
                                      <h5 className="font-bold text-slate-900 dark:text-white mb-1 line-clamp-2 text-base" title={quiz.title}>
                                        {quiz.title}
                                      </h5>
                                      
                                      <div className="text-xs text-slate-500 dark:text-slate-400 mb-6 flex items-center gap-2">
                                        <span className="bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded font-bold">{quiz.questions.length} Question{quiz.questions.length > 1 ? 's' : ''}</span>
                                        <span>•</span>
                                        <span>{quiz.date}</span>
                                        {quiz.docName && (
                                          <>
                                            <span>•</span>
                                            <span className="truncate max-w-[120px]" title={quiz.docName}>{quiz.docName}</span>
                                          </>
                                        )}
                                      </div>
                                      
                                      <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                                        <button
                                          onClick={() => setViewingQuizModal(quiz)}
                                          className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                                        >
                                          <Eye className="w-3.5 h-3.5" />
                                          Questions
                                        </button>
                                        <button
                                          onClick={() => loadQuiz(quiz)}
                                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1 shadow-sm cursor-pointer"
                                        >
                                          <Award className="w-3.5 h-3.5" />
                                          Lancer QCM
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}

                          {/* 2. ANALYSES RAG */}
                          {(generatedFilter === 'all' || generatedFilter === 'analyses') && savedDocAnalyses.length > 0 && (
                            <div>
                              <div className="flex items-center gap-2 mb-4">
                                <Sparkles className="w-5 h-5 text-amber-500" />
                                <h4 className="text-lg font-bold text-slate-900 dark:text-white">Analyses RAG de Documents ({savedDocAnalyses.filter(a => matchesGeneratedFolderFilter(a.folderId)).length})</h4>
                              </div>
                              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {savedDocAnalyses
                                  .filter(a => a.docName.toLowerCase().includes(librarySearchQuery.toLowerCase()) && matchesGeneratedFolderFilter(a.folderId))
                                  .map(analysis => (
                                    <div key={analysis.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow group flex flex-col">
                                      <div className="flex items-start justify-between mb-3 gap-2">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <div className="w-10 h-10 bg-amber-50 dark:bg-amber-900/30 rounded-xl flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                                            <Sparkles className="w-5 h-5" />
                                          </div>
                                          {analysis.folderName ? (
                                            <span className="bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 shrink-0">
                                              <Folder className="w-3 h-3 text-indigo-500" />
                                              {analysis.folderName}
                                            </span>
                                          ) : (
                                            <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 shrink-0">
                                              <Home className="w-3 h-3 text-slate-400" />
                                              Racine
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <button
                                            onClick={() => setMoveModalResource({ type: 'analysis', id: analysis.id, title: analysis.docName })}
                                            className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors opacity-0 group-hover:opacity-100 p-1 cursor-pointer"
                                            title="Déplacer dans un dossier"
                                          >
                                            <FolderInput className="w-4 h-4" />
                                          </button>
                                          <button 
                                            onClick={() => setSavedDocAnalyses(prev => prev.filter(a => a.id !== analysis.id))}
                                            className="text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-1 cursor-pointer"
                                            title="Supprimer"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                        </div>
                                      </div>
                                      
                                      <h5 className="font-bold text-slate-900 dark:text-white mb-1 line-clamp-2 text-base" title={analysis.docName}>
                                        {analysis.docName}
                                      </h5>
                                      
                                      <div className="text-xs text-slate-500 dark:text-slate-400 mb-6 flex items-center gap-2">
                                        {analysis.pageRange && <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-mono">{analysis.pageRange}</span>}
                                        <span>•</span>
                                        <span>{new Date(analysis.createdAt).toLocaleDateString()}</span>
                                      </div>
                                      
                                      <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                                        <button
                                          onClick={() => {
                                            setDocAnalysisResult(analysis);
                                            setAppState('DOCUMENT_ANALYSIS');
                                          }}
                                          className="flex-1 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-300 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                                        >
                                          <Eye className="w-3.5 h-3.5" />
                                          Consulter l'analyse
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}

                          {/* 3. FICHES DE REVISION */}
                          {(generatedFilter === 'all' || generatedFilter === 'fact_sheets') && savedFactSheets.length > 0 && (
                            <div>
                              <div className="flex items-center gap-2 mb-4">
                                <BookOpenCheck className="w-5 h-5 text-emerald-500" />
                                <h4 className="text-lg font-bold text-slate-900 dark:text-white">Fiches de Révision ({savedFactSheets.filter(s => matchesGeneratedFolderFilter(s.folderId)).length})</h4>
                              </div>
                              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {savedFactSheets
                                  .filter(s => s.title.toLowerCase().includes(librarySearchQuery.toLowerCase()) && matchesGeneratedFolderFilter(s.folderId))
                                  .map(sheet => (
                                    <div key={sheet.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow group flex flex-col">
                                      <div className="flex items-start justify-between mb-3 gap-2">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                                            <BookOpenCheck className="w-5 h-5" />
                                          </div>
                                          {sheet.folderName ? (
                                            <span className="bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 shrink-0">
                                              <Folder className="w-3 h-3 text-indigo-500" />
                                              {sheet.folderName}
                                            </span>
                                          ) : (
                                            <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 shrink-0">
                                              <Home className="w-3 h-3 text-slate-400" />
                                              Racine
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <button
                                            onClick={() => setMoveModalResource({ type: 'fact_sheet', id: sheet.id, title: sheet.title })}
                                            className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors opacity-0 group-hover:opacity-100 p-1 cursor-pointer"
                                            title="Déplacer dans un dossier"
                                          >
                                            <FolderInput className="w-4 h-4" />
                                          </button>
                                          <button 
                                            onClick={() => setSavedFactSheets(prev => prev.filter(s => s.id !== sheet.id))}
                                            className="text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-1 cursor-pointer"
                                            title="Supprimer"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                        </div>
                                      </div>
                                      
                                      <h5 className="font-bold text-slate-900 dark:text-white mb-1 line-clamp-2 text-base" title={sheet.title}>
                                        {sheet.title}
                                      </h5>
                                      
                                      <div className="text-xs text-slate-500 dark:text-slate-400 mb-6 flex items-center gap-2">
                                        <span>{sheet.concepts?.length || 0} notion(s)</span>
                                        <span>•</span>
                                        <span>{new Date(sheet.createdAt).toLocaleDateString()}</span>
                                      </div>
                                      
                                      <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                                        <button
                                          onClick={() => {
                                            setFactSheetContent(sheet);
                                            setAppState('FACT_SHEET');
                                          }}
                                          className="flex-1 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                                        >
                                          <Eye className="w-3.5 h-3.5" />
                                          Consulter la fiche
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}

                          {/* 4. FLASHCARDS */}
                          {(generatedFilter === 'all' || generatedFilter === 'flashcards') && savedFlashcards.length > 0 && (
                            <div>
                              <div className="flex items-center gap-2 mb-4">
                                <Layers className="w-5 h-5 text-indigo-500" />
                                <h4 className="text-lg font-bold text-slate-900 dark:text-white">Paquets de Flashcards ({savedFlashcards.filter(d => matchesGeneratedFolderFilter(d.folderId)).length})</h4>
                              </div>
                              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {savedFlashcards
                                  .filter(d => d.title.toLowerCase().includes(librarySearchQuery.toLowerCase()) && matchesGeneratedFolderFilter(d.folderId))
                                  .map(deck => (
                                    <div key={deck.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow group flex flex-col">
                                      <div className="flex items-start justify-between mb-3 gap-2">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                                            <Layers className="w-5 h-5" />
                                          </div>
                                          {deck.folderName ? (
                                            <span className="bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 shrink-0">
                                              <Folder className="w-3 h-3 text-indigo-500" />
                                              {deck.folderName}
                                            </span>
                                          ) : (
                                            <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 shrink-0">
                                              <Home className="w-3 h-3 text-slate-400" />
                                              Racine
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <button
                                            onClick={() => setMoveModalResource({ type: 'flashcard', id: deck.id, title: deck.title })}
                                            className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors opacity-0 group-hover:opacity-100 p-1 cursor-pointer"
                                            title="Déplacer dans un dossier"
                                          >
                                            <FolderInput className="w-4 h-4" />
                                          </button>
                                          <button 
                                            onClick={() => setSavedFlashcards(prev => prev.filter(d => d.id !== deck.id))}
                                            className="text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-1 cursor-pointer"
                                            title="Supprimer"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                        </div>
                                      </div>
                                      
                                      <h5 className="font-bold text-slate-900 dark:text-white mb-1 line-clamp-2 text-base" title={deck.title}>
                                        {deck.title}
                                      </h5>
                                      
                                      <div className="text-xs text-slate-500 dark:text-slate-400 mb-6 flex items-center gap-2">
                                        <span>{deck.cards.length} carte(s)</span>
                                        <span>•</span>
                                        <span>{new Date(deck.createdAt).toLocaleDateString()}</span>
                                      </div>
                                      
                                      <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                                        <button
                                          onClick={() => {
                                            setFlashcards(deck.cards);
                                            setCurrentFlashcardIndex(0);
                                            setIsFlashcardFlipped(false);
                                            setAppState('FLASHCARDS');
                                          }}
                                          className="flex-1 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1"
                                        >
                                          <Layers className="w-3.5 h-3.5" />
                                          Réviser le paquet
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {activeTab === 'dashboard' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                {savedQuizzes.length > 0 && (
                  <div className="mb-12">
                    <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                  <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200">Tests récents</h3>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  {savedQuizzes.map(quiz => (
                    <div 
                      key={quiz.id} 
                      onClick={() => loadQuiz(quiz)}
                      className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-blue-300 dark:hover:border-blue-500/50 hover:shadow-sm transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-xl text-slate-500 dark:text-slate-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          <FileText className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-slate-900 dark:text-white truncate max-w-[150px] sm:max-w-[120px] md:max-w-[180px]">{quiz.title}</h4>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                            {quiz.questions.length} questions • {quiz.date}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={(e) => deleteQuiz(quiz.id, e)}
                          className="p-2 text-slate-400 dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                        <ChevronRight className="w-5 h-5 text-slate-400 dark:text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-blue-50 dark:bg-slate-800/50 p-8 rounded-3xl border border-blue-100 dark:border-slate-700">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Ressources Officielles INSP & EPSO</h3>
              <div className="grid sm:grid-cols-2 gap-4 text-sm font-medium">
                <a href="https://eu-careers.europa.eu/en/graduates-administrators-ad5" target="_blank" rel="noreferrer" className="flex items-center gap-2 p-3 bg-white dark:bg-slate-800 rounded-xl hover:shadow-sm text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-all border border-blue-100 dark:border-slate-700">
                  <ChevronRight className="w-4 h-4 shrink-0" /> EU Careers - AD5
                </a>
                <a href="https://www.europarl.europa.eu/factsheets/en/home" target="_blank" rel="noreferrer" className="flex items-center gap-2 p-3 bg-white dark:bg-slate-800 rounded-xl hover:shadow-sm text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-all border border-blue-100 dark:border-slate-700">
                  <ChevronRight className="w-4 h-4 shrink-0" /> Fiches thématiques du Parlement
                </a>
                <a href="https://www.gesis.org/en/eurobarometer-data-service" target="_blank" rel="noreferrer" className="flex items-center gap-2 p-3 bg-white dark:bg-slate-800 rounded-xl hover:shadow-sm text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-all border border-blue-100 dark:border-slate-700">
                  <ChevronRight className="w-4 h-4 shrink-0" /> Eurobarometer Data Service
                </a>
                <a href="https://commission.europa.eu/about/commission-2024-2029_en" target="_blank" rel="noreferrer" className="flex items-center gap-2 p-3 bg-white dark:bg-slate-800 rounded-xl hover:shadow-sm text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-all border border-blue-100 dark:border-slate-700">
                  <ChevronRight className="w-4 h-4 shrink-0" /> Commission 2024-2029
                </a>
                <a href="https://digital-skills-jobs.europa.eu/en/learning-space/self-assessment-tools" target="_blank" rel="noreferrer" className="flex items-center gap-2 p-3 bg-white dark:bg-slate-800 rounded-xl hover:shadow-sm text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-all border border-blue-100 dark:border-slate-700">
                  <ChevronRight className="w-4 h-4 shrink-0" /> Self-Assessment Tools
                </a>
                <a href="https://op.europa.eu/s/Ai5l" target="_blank" rel="noreferrer" className="flex items-center gap-2 p-3 bg-white dark:bg-slate-800 rounded-xl hover:shadow-sm text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-all border border-blue-100 dark:border-slate-700">
                  <ChevronRight className="w-4 h-4 shrink-0" /> Guide DigComp 2.2
                </a>
              </div>
            </div>
              </div>
            )}
          </div>
        )}

        {appState === 'PROCESSING' && (
          <div className="py-12 px-4 flex items-center justify-center animate-in fade-in zoom-in-95 duration-300">
            <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 md:p-10 shadow-2xl relative overflow-hidden text-center">
              {/* Effet halo lumineux arrière-plan */}
              <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-64 h-64 bg-indigo-500/15 dark:bg-indigo-500/25 blur-3xl rounded-full pointer-events-none"></div>
              <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 w-64 h-64 bg-emerald-500/10 dark:bg-emerald-500/20 blur-3xl rounded-full pointer-events-none"></div>

              {/* Icone animée avec spinner concentrique */}
              <div className="relative w-24 h-24 mx-auto mb-6 flex items-center justify-center">
                <div className="absolute inset-0 border-4 border-indigo-100 dark:border-indigo-950 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-indigo-600 dark:border-indigo-400 rounded-full border-t-transparent animate-spin"></div>
                <div className="absolute inset-2 border-2 border-dashed border-emerald-400 dark:border-emerald-500 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '6s' }}></div>
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-700/50 flex items-center justify-center text-indigo-600 dark:text-indigo-300 shadow-inner">
                  <BrainCircuit className="w-6 h-6 animate-pulse" />
                </div>
              </div>

              {/* Titre dynamique selon docProcessingType */}
              <h2 className="text-2xl font-bold font-heading text-slate-900 dark:text-white mb-2">
                {docProcessingType === 'qcm' ? "Génération du QCM EPSO..." :
                 docProcessingType === 'document_analysis' ? "Analyse RAG du Document..." :
                 docProcessingType === 'vocab' ? "Extraction du Vocabulaire..." :
                 docProcessingType === 'english' ? "Préparation du Test d'Anglais..." :
                 "Génération de la Fiche de Révision..."}
              </h2>

              {/* Sous-titre explicatif */}
              {processingProgress ? (
                <p className="text-slate-600 dark:text-slate-300 font-medium text-sm mb-6">
                  Traitement du segment <span className="font-bold text-indigo-600 dark:text-indigo-400">{processingProgress.current}</span> sur <span className="font-bold text-indigo-600 dark:text-indigo-400">{processingProgress.total}</span>...
                </p>
              ) : (
                <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm mx-auto mb-6 leading-relaxed">
                  L'intelligence artificielle extrait les notions clés, formules et pièges pour générer votre module d'apprentissage...
                </p>
              )}

              {/* Barre de progression ou animation fluide */}
              {processingProgress ? (
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 mb-6 p-0.5 border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-indigo-500 to-emerald-500 h-full rounded-full transition-all duration-500 shadow-xs"
                    style={{ width: `${(processingProgress.current / processingProgress.total) * 100}%` }}
                  ></div>
                </div>
              ) : (
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mb-6 overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-emerald-400 to-indigo-500 w-1/2 h-full rounded-full animate-pulse"></div>
                </div>
              )}

              {/* Étapes du processus */}
              <div className="grid grid-cols-3 gap-2 mb-8 text-[11px] font-semibold">
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-indigo-600 dark:text-indigo-300 flex flex-col items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>1. Lecture</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-indigo-600 dark:text-indigo-300 flex flex-col items-center gap-1">
                  <Brain className="w-3.5 h-3.5" />
                  <span>2. Raisonnement</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-emerald-600 dark:text-emerald-400 flex flex-col items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>3. Structuration</span>
                </div>
              </div>

              {/* Bouton d'annulation */}
              <button
                onClick={resetApp}
                className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold transition-all border border-slate-200 dark:border-slate-700"
              >
                Annuler le traitement
              </button>
            </div>
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
                      buttonClass += "border-slate-200 dark:border-slate-700 hover:border-blue-600 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-slate-700 dark:text-slate-300 hover:text-blue-900 dark:hover:text-blue-300 bg-white dark:bg-slate-800";
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
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-full font-semibold text-lg transition-transform hover:scale-105 active:scale-95"
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
          <div className="max-w-3xl mx-auto text-center py-12">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-full mb-8">
              <Award className="w-12 h-12" />
            </div>
            <h2 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">Test Terminé !</h2>
            <p className="text-xl text-slate-600 dark:text-slate-400 mb-10">
              Score : <span className="font-bold text-blue-600 dark:text-blue-400">{score}</span> sur <span className="font-bold text-slate-900 dark:text-white">{questions.length}</span>
            </p>
            
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-4 mb-12 overflow-hidden">
              <div 
                className="bg-blue-600 dark:bg-blue-500 h-4 rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${(score / questions.length) * 100}%` }}
              ></div>
            </div>

            <div className="flex flex-wrap justify-center gap-4 mb-12">
              <button
                onClick={handleRetryTest}
                className="inline-flex items-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-6 py-3 rounded-xl font-semibold transition-colors"
              >
                <RotateCcw className="w-5 h-5" />
                Refaire le test
              </button>
              
              <button
                onClick={() => setShowReview(!showReview)}
                className="inline-flex items-center gap-2 bg-indigo-100 dark:bg-indigo-900/40 hover:bg-indigo-200 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 px-6 py-3 rounded-xl font-semibold transition-colors"
              >
                <Eye className="w-5 h-5" />
                {showReview ? "Masquer les réponses" : "Visualiser les réponses"}
              </button>
              
              <button
                onClick={generateCustomReviewSheet}
                className="inline-flex items-center gap-2 bg-emerald-100 dark:bg-emerald-900/40 hover:bg-emerald-200 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 px-6 py-3 rounded-xl font-semibold transition-colors"
              >
                <BookOpenCheck className="w-5 h-5" />
                Fiche de révision
              </button>
            </div>

            {showReview && (
              <div className="text-left space-y-6 mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {questions.map((q, qIndex) => {
                  const userAnswer = userAnswers[qIndex];
                  const isCorrect = userAnswer === q.correctAnswerIndex;
                  return (
                    <div key={qIndex} className={cn("p-6 rounded-2xl border text-left", isCorrect ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-900/10" : "border-rose-200 bg-rose-50 dark:border-rose-900/50 dark:bg-rose-900/10")}>
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <h4 className="font-bold text-slate-900 dark:text-white text-lg">
                          Question {qIndex + 1}
                        </h4>
                        {isCorrect ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                            Correct
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300">
                            Incorrect
                          </span>
                        )}
                      </div>
                      
                      {q.context && (
                        <div className="mb-4 p-4 bg-white/60 dark:bg-slate-900/50 rounded-xl prose prose-sm max-w-none prose-slate dark:prose-invert">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{q.context}</ReactMarkdown>
                        </div>
                      )}
                      
                      <p className="font-medium text-slate-800 dark:text-slate-200 mb-4">{q.question}</p>
                      
                      <div className="space-y-2 mb-4">
                        {q.options.map((option, oIndex) => (
                          <div 
                            key={oIndex}
                            className={cn(
                              "p-3 rounded-xl border text-sm flex justify-between items-center",
                              oIndex === q.correctAnswerIndex 
                                ? "border-emerald-500 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 font-bold"
                                : oIndex === userAnswer && !isCorrect
                                  ? "border-rose-500 bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-200 font-bold"
                                  : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 opacity-50"
                            )}
                          >
                            <span>{option}</span>
                            {oIndex === q.correctAnswerIndex && <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                            {oIndex === userAnswer && !isCorrect && <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />}
                          </div>
                        ))}
                      </div>

                      {q.explanation && (
                        <div className="mt-4 p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                          <div className="flex items-center gap-2 mb-2">
                            <BookOpen className="w-4 h-4 text-blue-500" />
                            <span className="font-bold text-slate-900 dark:text-white text-sm">Explication</span>
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{q.explanation}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <button
              onClick={resetApp}
              className="inline-flex items-center gap-2 bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white px-8 py-4 rounded-full font-semibold text-lg transition-transform hover:scale-105 active:scale-95"
            >
              <RefreshCw className="w-5 h-5" />
              Retour à l'accueil
            </button>
          </div>
        )}

        {appState === 'ESSAY_WRITING' && essayPrompt && (
          <div className="max-w-3xl mx-auto">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-8">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{essayPrompt.title}</h2>
              <p className="text-lg text-slate-700 dark:text-slate-300 mb-6 bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                {essayPrompt.description}
              </p>
              
              <textarea
                value={essayText}
                onChange={(e) => setEssayText(e.target.value)}
                placeholder="Write your essay here... (minimum 150 words recommended)"
                className="w-full h-64 p-4 border border-slate-300 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 resize-y mb-6 font-medium leading-relaxed"
              ></textarea>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {essayText.trim().split(/\s+/).filter(w => w.length > 0).length} words
                </span>
                <div className="flex gap-4">
                  <button
                    onClick={resetApp}
                    className="px-6 py-4 rounded-full font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={evaluateEssay}
                    disabled={essayText.trim().length === 0}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-4 rounded-full font-semibold text-lg transition-transform hover:scale-105 active:scale-95"
                  >
                    <CheckCircle className="w-5 h-5" />
                    Soumettre pour correction
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {appState === 'ESSAY_RESULTS' && essayEvaluation && essayPrompt && (
          <div className="max-w-3xl mx-auto">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="p-8 border-b border-slate-200 dark:border-slate-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Résultat d'évaluation</h2>
                  <div className="inline-flex items-center justify-center bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-6 py-3 rounded-2xl">
                    <span className="text-4xl font-bold mr-1">{essayEvaluation.score}</span>
                    <span className="text-lg font-medium opacity-80">/ {essayEvaluation.maxScore}</span>
                  </div>
                </div>
              </div>
              
              <div className="p-8 space-y-8 bg-slate-50 dark:bg-slate-950">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                    <CheckCircle className="w-6 h-6 text-emerald-500" />
                    Feedback Détaillé
                  </h3>
                  <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 prose prose-slate dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {essayEvaluation.feedback}
                    </ReactMarkdown>
                  </div>
                </div>
                
                {essayEvaluation.corrections && (
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                      <FileText className="w-6 h-6 text-amber-500" />
                      Corrections & Suggestions
                    </h3>
                    <div className="p-5 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-800/30 text-amber-900 dark:text-amber-200 prose prose-amber dark:prose-invert max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {essayEvaluation.corrections}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}
                
                <div className="flex justify-center pt-4">
                  <button
                    onClick={resetApp}
                    className="inline-flex items-center gap-2 bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white px-8 py-4 rounded-full font-semibold text-lg transition-transform hover:scale-105 active:scale-95"
                  >
                    <RefreshCw className="w-5 h-5" />
                    Nouveau Test
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {appState === 'FACT_SHEET' && factSheetContent && (
          <div className="max-w-4xl mx-auto print-area">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
              {/* En-tete structure avec barre d'outils */}
              <div className="p-6 md:p-8 border-b border-slate-200 dark:border-slate-800 print-header">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white font-heading flex items-center gap-3 mb-2">
                      <FileText className="w-7 h-7 text-emerald-500 shrink-0" />
                      {factSheetContent.title}
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      {factSheetContent.topic && (
                        <span className="print-badge px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                          {factSheetContent.topic}
                        </span>
                      )}
                      {factSheetContent.docName && (
                        <span className="print-badge px-3 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                          Source: {factSheetContent.docName}
                        </span>
                      )}
                      <span className="print-badge px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        {factSheetContent.concepts ? `${factSheetContent.concepts.length} concepts` : 'Fiche Synthèse'}
                      </span>
                    </div>
                  </div>

                  {/* Barre d'outils interactive */}
                  <div className="flex items-center gap-2 no-print self-end md:self-auto">
                    {/* Selecteur de disposition : Liste / Grille */}
                    {factSheetContent.concepts && (
                      <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                        <button
                          onClick={() => setFactSheetLayout('list')}
                          className={cn(
                            "p-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1",
                            factSheetLayout === 'list'
                              ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                              : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                          )}
                          title="Vue Liste Détaillée"
                        >
                          <List className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setFactSheetLayout('grid')}
                          className={cn(
                            "p-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1",
                            factSheetLayout === 'grid'
                              ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                              : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                          )}
                          title="Vue Grille Synthétique"
                        >
                          <LayoutGrid className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {/* Mode Auto-évaluation */}
                    {factSheetContent.concepts && (
                      <button
                        onClick={() => {
                          setFactSheetAutoEval(!factSheetAutoEval);
                          setRevealedConcepts({});
                        }}
                        className={cn(
                          "px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border",
                          factSheetAutoEval
                            ? "bg-violet-600 text-white border-violet-600 shadow-xs"
                            : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
                        )}
                        title="Masquer les réponses pour vous tester"
                      >
                        {factSheetAutoEval ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        <span className="hidden sm:inline">{factSheetAutoEval ? "Auto-Eval Actif" : "Mode Test"}</span>
                      </button>
                    )}

                    {/* Export PDF */}
                    <button
                      onClick={() => window.print()}
                      className="p-2.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-xl transition-colors border border-indigo-200 dark:border-indigo-800"
                      title="Exporter en PDF"
                    >
                      <Download className="w-5 h-5" />
                    </button>

                    <button
                      onClick={resetApp}
                      className="p-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <XCircle className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Corps de la fiche */}
              <div className="p-6 md:p-8 bg-slate-50/50 dark:bg-slate-950">
                {factSheetContent.concepts ? (
                  <div
                    className={cn(
                      factSheetLayout === 'grid'
                        ? "grid grid-cols-1 md:grid-cols-2 gap-5 space-y-0"
                        : "space-y-5"
                    )}
                  >
                    {factSheetContent.concepts.map((concept: any, idx: number) => {
                      // Detection du type de callout
                      const term = (concept.term || '').toLowerCase();
                      const category = (concept.category || '').toLowerCase();
                      let calloutClass = 'callout';
                      let iconColor = 'text-slate-500';
                      if (/institution|organe|parlement|commission|conseil|cour|bce|comit/i.test(term + ' ' + category)) {
                        calloutClass += ' callout-institutions';
                        iconColor = 'text-blue-500';
                      } else if (/politique|pac|green|march|cohésion|pesc|concurrence|numérique/i.test(term + ' ' + category)) {
                        calloutClass += ' callout-policies';
                        iconColor = 'text-emerald-500';
                      } else if (/date|trait|chronolog|histori|fondateur|schuman|élargissement|maastricht|lisbonne|rome|ceca/i.test(term + ' ' + category)) {
                        calloutClass += ' callout-dates';
                        iconColor = 'text-amber-500';
                      } else if (/vocab|sigle|acronym|terme|juridique|définition|glossaire/i.test(term + ' ' + category)) {
                        calloutClass += ' callout-vocabulary';
                        iconColor = 'text-violet-500';
                      } else {
                        calloutClass += ' callout-institutions';
                        iconColor = 'text-blue-500';
                      }

                      // Calcul de l'importance pour EPSO
                      const isEssential = concept.date || /traité|institution|règlement|directive|conseil|commission|bce|primauté|effet direct/i.test(term);
                      const isRevealed = !factSheetAutoEval || revealedConcepts[idx];

                      return (
                        <div
                          key={idx}
                          className={cn(`${calloutClass} print-page-break-avoid animate-card-in`, factSheetLayout === 'grid' && "mb-0")}
                          style={{ animationDelay: `${Math.min(idx * 0.04, 0.4)}s` }}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-3">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white font-heading flex items-center gap-2">
                              <BookOpen className={`w-5 h-5 ${iconColor} shrink-0`} />
                              {concept.term}
                            </h3>
                            <div className="flex items-center gap-2 shrink-0">
                              {isEssential && (
                                <span className="print-badge text-[11px] font-bold px-2 py-0.5 bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 rounded-md border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                                  <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                                  Essentiel
                                </span>
                              )}
                              {concept.date && (
                                <span className="print-badge text-xs font-bold px-2.5 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 rounded-lg whitespace-nowrap border border-amber-200 dark:border-amber-800">
                                  {concept.date}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Mode auto-évaluation : masquer ou afficher */}
                          {factSheetAutoEval && !isRevealed ? (
                            <div className="py-6 px-4 text-center bg-white/70 dark:bg-slate-900/70 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 my-2">
                              <p className="text-xs font-semibold text-slate-500 mb-2">Réponse masquée (Mode Test)</p>
                              <button
                                onClick={() => setRevealedConcepts(prev => ({ ...prev, [idx]: true }))}
                                className="px-4 py-1.5 bg-violet-100 dark:bg-violet-900/40 hover:bg-violet-200 text-violet-700 dark:text-violet-300 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 mx-auto cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Révéler la définition
                              </button>
                            </div>
                          ) : (
                            <>
                              {concept.definition && (
                                <div className="mb-3">
                                  <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1 font-heading">Définition</p>
                                  <p className="text-slate-800 dark:text-slate-200 font-medium leading-relaxed text-sm">{concept.definition}</p>
                                </div>
                              )}

                              {concept.explanation && (
                                <div className="mb-3">
                                  <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1 font-heading">Explication</p>
                                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm">{concept.explanation}</p>
                                </div>
                              )}

                              {concept.example && (
                                <div className="bg-white/70 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1 flex items-center gap-1 font-heading">
                                    <CheckCircle className="w-3.5 h-3.5" /> Exemple concret
                                  </p>
                                  <p className="text-slate-700 dark:text-slate-300 text-xs italic leading-relaxed">"{concept.example}"</p>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="prose prose-slate dark:prose-invert max-w-none text-slate-800 dark:text-slate-200">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {factSheetContent.content || ""}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {appState === 'FLASHCARDS' && flashcards.length > 0 && (
          <div className="max-w-2xl mx-auto">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-6 h-6 text-blue-500" />
                Flashcards
              </h2>
              <span className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-4 py-1.5 rounded-full text-sm font-semibold">
                {currentFlashcardIndex + 1} / {flashcards.length}
              </span>
            </div>

            <div className="relative w-full aspect-video" style={{ perspective: '1000px' }}>
              <div 
                onClick={() => setIsFlashcardFlipped(!isFlashcardFlipped)}
                className="w-full h-full cursor-pointer transition-transform duration-500"
                style={{ 
                  transformStyle: 'preserve-3d', 
                  transform: isFlashcardFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' 
                }}
              >
                {/* Front */}
                <div 
                  className="absolute inset-0 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl p-8 flex flex-col items-center justify-center shadow-md"
                  style={{ backfaceVisibility: 'hidden' }}
                >
                  <p className="text-sm font-semibold text-slate-400 mb-4 uppercase tracking-wider">Concept</p>
                  <h3 className="text-3xl font-bold text-slate-800 dark:text-slate-100 text-center">{flashcards[currentFlashcardIndex].front}</h3>
                </div>
                
                {/* Back */}
                <div 
                  className="absolute inset-0 bg-blue-50 dark:bg-slate-800 border-2 border-blue-200 dark:border-slate-700 rounded-3xl p-8 flex flex-col items-center justify-center shadow-md"
                  style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                >
                  <p className="text-sm font-semibold text-blue-500 dark:text-blue-400 mb-4 uppercase tracking-wider">Définition</p>
                  <p className="text-xl font-medium text-slate-700 dark:text-slate-200 text-center leading-relaxed">{flashcards[currentFlashcardIndex].back}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-8">
              <button 
                onClick={() => {
                  setIsFlashcardFlipped(false);
                  setTimeout(() => setCurrentFlashcardIndex(prev => Math.max(0, prev - 1)), 150);
                }}
                disabled={currentFlashcardIndex === 0}
                className="p-4 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-all shadow-sm"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              
              <button
                onClick={resetApp}
                className="px-8 py-3 rounded-full text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold transition-colors"
              >
                Terminer la révision
              </button>
              
              <button 
                onClick={() => {
                  setIsFlashcardFlipped(false);
                  setTimeout(() => setCurrentFlashcardIndex(prev => Math.min(flashcards.length - 1, prev + 1)), 150);
                }}
                disabled={currentFlashcardIndex === flashcards.length - 1}
                className="p-4 rounded-full bg-blue-600 border border-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-300 disabled:border-slate-300 dark:disabled:bg-slate-700 dark:disabled:border-slate-700 disabled:text-slate-500 transition-all shadow-sm"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>
          </div>
        )}

        {appState === 'DOCUMENT_ANALYSIS' && docAnalysisResult && (
          <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 print-area">
            {/* Header Card */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-100 dark:border-slate-800 print-header">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="print-badge px-3 py-1 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      Analyse RAG Document
                    </span>
                    {docAnalysisResult.pageRange && (
                      <span className="print-badge px-3 py-1 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 rounded-full text-xs font-semibold">
                        {docAnalysisResult.pageRange}
                      </span>
                    )}
                    <span className="print-badge px-3 py-1 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-full text-xs font-mono font-bold flex items-center gap-1">
                      <Hash className="w-3 h-3" />
                      Seed #{docAnalysisResult.seed}
                    </span>
                  </div>
                  <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white leading-tight font-serif">
                    {docAnalysisResult.docName}
                  </h1>
                </div>

                <div className="flex items-center gap-3 no-print">
                  <button
                    onClick={() => window.print()}
                    className="p-2.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-xl transition-colors border border-indigo-200 dark:border-indigo-800"
                    title="Exporter en PDF"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => analyzeDocument()}
                    className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-bold transition-all shadow-sm"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Régénérer (Nouveau Seed)
                  </button>
                  <button
                    onClick={() => setAppState('UPLOAD')}
                    className="p-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Synthèse globale */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-500" />
                  Synthèse Exécutive
                </h3>
                <div className="prose prose-slate dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 leading-relaxed font-medium bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {docAnalysisResult.summary}
                  </ReactMarkdown>
                </div>
              </div>
            </div>

            {/* SECTION CENTRALE : ARCHITECTURE DE NOTIONS & DÉCOUPAGE THÉMATIQUE */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border-2 border-[#2f647e]/30 dark:border-[#2f647e]/50 shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase bg-[#2f647e]/10 text-[#2f647e] dark:bg-[#76a9c5]/20 dark:text-[#9acdeb] mb-2">
                    <Layers className="w-3.5 h-3.5" />
                    Architecture Source & Matrice de Notions
                  </span>
                  <h2 className="text-2xl font-serif font-bold text-slate-900 dark:text-white">
                    Découpage Thématique & Notions Clés ({docAnalysisResult.notions?.length || 0})
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Les notions extraites ci-dessous constituent le découpage de référence pour la génération ciblée de vos QCM, Fiches et Flashcards.
                  </p>
                </div>
              </div>

              {/* Modules & Notions */}
              {docAnalysisResult.modules && docAnalysisResult.modules.length > 0 ? (
                <div className="space-y-8">
                  {docAnalysisResult.modules.map((mod, modIdx) => (
                    <div key={modIdx} className="bg-slate-50/80 dark:bg-slate-800/40 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-700/60">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="w-8 h-8 rounded-xl bg-[#2f647e] text-white font-extrabold flex items-center justify-center text-sm shrink-0">
                          M{mod.moduleNumber || (modIdx + 1)}
                        </span>
                        <div>
                          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                            {mod.title}
                          </h3>
                          {mod.description && (
                            <p className="text-xs text-slate-500 dark:text-slate-400">{mod.description}</p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 mt-4">
                        {mod.notions && mod.notions.length > 0 ? (
                          mod.notions.map((notion, nIdx) => (
                            <div key={nIdx} className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs hover:border-[#2f647e]/50 transition-all">
                              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                  <BookOpen className="w-4 h-4 text-[#2f647e]" />
                                  {notion.title}
                                </h4>
                                <div className="flex items-center gap-2">
                                  <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                                    {notion.category}
                                  </span>
                                  {notion.sourcePage && (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                      {notion.sourcePage}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <p className="text-xs text-slate-600 dark:text-slate-300 mb-3 leading-relaxed">
                                {notion.summary}
                              </p>

                              {notion.keyPoints && notion.keyPoints.length > 0 && (
                                <ul className="mb-4 space-y-1 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                                  {notion.keyPoints.map((kp, kpIdx) => (
                                    <li key={kpIdx} className="text-[11px] text-slate-700 dark:text-slate-300 flex items-start gap-1.5 font-medium">
                                      <span className="text-[#2f647e] font-bold">•</span>
                                      <span>{kp}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}

                              {/* Actions ciblées sur cette notion (documents de révision uniquement) */}
                              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                                <button
                                  onClick={() => generateFactSheetFromNotion(notion, docAnalysisResult.docName)}
                                  className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/80 dark:text-emerald-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                                  title="Créer une fiche de révision ciblée"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  <span>Fiche de Révision</span>
                                </button>

                                <button
                                  onClick={() => generateFlashcardsFromNotion(notion, docAnalysisResult.docName)}
                                  className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:hover:bg-blue-900/80 dark:text-blue-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                                  title="Créer un paquet de flashcards"
                                >
                                  <Layers className="w-3.5 h-3.5" />
                                  <span>Flashcards</span>
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-slate-400 italic">Aucune notion isolée pour ce module.</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : docAnalysisResult.notions && docAnalysisResult.notions.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {docAnalysisResult.notions.map((notion, nIdx) => (
                    <div key={nIdx} className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-[#2f647e]" />
                          {notion.title}
                        </h4>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                          {notion.category}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mb-3 leading-relaxed">{notion.summary}</p>
                      
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                        <button
                          onClick={() => generateFactSheetFromNotion(notion, docAnalysisResult.docName)}
                          className="px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300 text-xs font-bold hover:bg-emerald-200 transition-colors"
                        >
                          Fiche
                        </button>
                        <button
                          onClick={() => generateFlashcardsFromNotion(notion, docAnalysisResult.docName)}
                          className="px-2.5 py-1 rounded-md bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 text-xs font-bold hover:bg-blue-200 transition-colors"
                        >
                          Flashcards
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500 italic">Aucune notion extraite.</p>
              )}
            </div>

            {/* Grid 2 Columns: Takeaways & Key Figures */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Takeaways */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <ListChecks className="w-5 h-5 text-emerald-500" />
                  Points Clés EPSO à Retenir
                </h3>
                <ul className="space-y-3 flex-1">
                  {docAnalysisResult.takeaways.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300 bg-emerald-50/50 dark:bg-emerald-900/10 p-3.5 rounded-xl border border-emerald-100 dark:border-emerald-800/30">
                      <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <span className="font-medium leading-snug">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Key Figures */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-indigo-500" />
                  Données & Chiffres Clés
                </h3>
                <div className="space-y-3 flex-1 overflow-y-auto max-h-[420px] pr-1">
                  {docAnalysisResult.keyFigures.map((fig, idx) => (
                    <div key={idx} className="p-3.5 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-800/30">
                      <span className="inline-block font-extrabold text-indigo-700 dark:text-indigo-300 text-base mb-1 bg-indigo-100 dark:bg-indigo-900/40 px-2.5 py-0.5 rounded-lg">
                        {fig.figure}
                      </span>
                      <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                        {fig.context}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Entities & Timeline */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Entities */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-500" />
                  Institutions & Acteurs Identifiés
                </h3>
                <div className="space-y-3">
                  {docAnalysisResult.entities.map((ent, idx) => (
                    <div key={idx} className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">{ent.name}</h4>
                      <p className="text-xs text-slate-600 dark:text-slate-400">{ent.role}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Timeline */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-purple-500" />
                  Chronologie & Traités
                </h3>
                <div className="space-y-3">
                  {docAnalysisResult.timeline.map((item, idx) => (
                    <div key={idx} className="flex gap-3 items-start p-3 bg-purple-50/50 dark:bg-purple-900/10 rounded-xl border border-purple-100 dark:border-purple-800/30">
                      <span className="px-2.5 py-1 bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 rounded-lg text-xs font-bold whitespace-nowrap">
                        {item.date}
                      </span>
                      <p className="text-xs text-slate-700 dark:text-slate-300 font-medium pt-0.5">{item.event}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Vocabulary Section */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-rose-500" />
                Vocabulaire & Sigles Spécifiques
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {docAnalysisResult.vocabulary.map((vocab, idx) => (
                  <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <h4 className="text-sm font-bold text-rose-700 dark:text-rose-400 mb-1">{vocab.term}</h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{vocab.definition}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => generateQuizFromDocument()}
                  className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all shadow-sm flex items-center gap-2"
                >
                  <BrainCircuit className="w-4 h-4" />
                  Générer un QCM basé sur ce document
                </button>
                <button
                  onClick={() => generateFactSheetOrVocabFromDocument('concepts')}
                  className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-all shadow-sm flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  Générer des Flashcards
                </button>
              </div>
              <button
                onClick={() => setAppState('UPLOAD')}
                className="px-5 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-semibold transition-colors"
              >
                Retour
              </button>
            </div>
          </div>
        )}

        {/* Modal for Moving Generated Resource */}
        {moveModalResource && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                  <FolderInput className="w-5 h-5" />
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Déplacer la ressource</h3>
                </div>
                <button
                  onClick={() => setMoveModalResource(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 line-clamp-2">
                Sélectionnez le dossier de destination pour : <strong className="text-slate-800 dark:text-slate-200">{moveModalResource.title}</strong>
              </p>

              <div className="max-h-60 overflow-y-auto space-y-1 pr-1 border border-slate-100 dark:border-slate-800 rounded-xl p-2 mb-6">
                <button
                  onClick={() => {
                    moveResourceToFolder(moveModalResource.type, moveModalResource.id, undefined);
                    setMoveModalResource(null);
                  }}
                  className="w-full flex items-center gap-2 p-2 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left cursor-pointer"
                >
                  <Home className="w-4 h-4 text-slate-400" />
                  <span>Racine (Aucun dossier)</span>
                </button>
                {renderFolderMoveTreeForResource(moveModalResource.type, moveModalResource.id, null, 0)}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setMoveModalResource(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal for viewing generated Quiz & Questions */}
        {viewingQuizModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
              <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                <div>
                  <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 rounded-full text-xs font-bold mb-1">
                    QCM Généré • {viewingQuizModal.questions.length} Question{viewingQuizModal.questions.length > 1 ? 's' : ''}
                  </span>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                    {viewingQuizModal.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Date de création : {viewingQuizModal.date}</p>
                </div>
                <button
                  onClick={() => setViewingQuizModal(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  title="Fermer"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-6 divide-y divide-slate-100 dark:divide-slate-800">
                {viewingQuizModal.questions.map((q, qIndex) => (
                  <div key={qIndex} className="pt-6 first:pt-0 space-y-3">
                    <div className="flex items-start gap-3">
                      <span className="w-7 h-7 bg-blue-600 text-white font-bold rounded-lg flex items-center justify-center text-xs shrink-0 mt-0.5">
                        Q{qIndex + 1}
                      </span>
                      <div className="flex-1">
                        <h4 className="font-semibold text-slate-900 dark:text-white text-base">
                          {q.question}
                        </h4>
                        {q.context && (
                          <div className="mt-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-mono overflow-x-auto">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{q.context}</ReactMarkdown>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 pl-10">
                      {q.options.map((option, optIdx) => {
                        const isCorrect = optIdx === q.correctAnswerIndex;
                        return (
                          <div
                            key={optIdx}
                            className={cn(
                              "p-3 rounded-xl border text-sm flex items-center justify-between",
                              isCorrect
                                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-900 dark:text-emerald-200 font-medium"
                                : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                            )}
                          >
                            <span>{option}</span>
                            {isCorrect && (
                              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-bold bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-md shrink-0">
                                <CheckCircle className="w-3.5 h-3.5" /> Bonne réponse
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {q.explanation && (
                      <div className="ml-10 p-3 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 rounded-xl text-xs text-indigo-900 dark:text-indigo-200">
                        <strong>Explication :</strong> {q.explanation}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3 bg-slate-50 dark:bg-slate-800/50">
                <button
                  onClick={() => setViewingQuizModal(null)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-sm font-medium transition-colors"
                >
                  Fermer
                </button>
                <button
                  onClick={() => {
                    const quizToLoad = viewingQuizModal;
                    setViewingQuizModal(null);
                    loadQuiz(quizToLoad);
                  }}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm"
                >
                  <Award className="w-4 h-4" />
                  Lancer ce QCM
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
