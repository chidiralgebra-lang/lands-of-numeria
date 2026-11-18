import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Cloud,
  CloudOff,
  Copy,
  Download,
  GraduationCap,
  Loader2,
  Lock,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  Unlock,
  Upload,
  Users,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import { AREA_BG_IMAGES, HEROES, MONSTERS } from '../data/worldData';
import {
  AreaDef,
  AttemptRecord,
  Difficulty,
  GameSettings,
  HeroDef,
  HeroId,
  MonsterDef,
  OnlineRoomSummary,
  Question,
  QuestionType,
} from '../types/game';
import { generateCsvTemplate, parseQuestionsFromCsv } from '../utils/mathEvaluator';
import { getApiUrl } from '../utils/api';
import {
  createFirestoreClassroom,
  endFirestoreClassroom,
  startFirestoreClassroom,
  subscribeFirestoreRoomTeacher,
} from '../utils/firebaseSync';
import { HeroMonsterEditorTab } from './HeroMonsterEditorTab';
import { PrintableReportSheet } from './PrintableReportSheet';
import {
  WorldMapPositionEditor,
  clampMapPos,
  findNonOverlappingPos,
} from './WorldMapPositionEditor';

interface TeacherPanelScreenProps {
  questions: Question[];
  areas: AreaDef[];
  heroes?: HeroDef[];
  monsters?: Record<string, MonsterDef>;
  activeHeroId?: HeroId;
  settings: GameSettings;
  attempts: AttemptRecord[];
  hasProfileProgress?: boolean;
  firebaseUser?: User | null;
  isTeacherAdmin?: boolean;
  authLoading?: boolean;
  authError?: string;
  onSignInGoogle?: () => void;
  onSignOutGoogle?: () => void;
  configSyncStatus?: 'checking' | 'synced' | 'syncing' | 'unsynced' | 'error';
  configSyncError?: string;
  lastSyncedAt?: string | null;
  attemptsLoading?: boolean;
  onPublishConfigNow?: () => void;
  onRefreshAttempts?: () => void;
  onUpdateQuestions: (next: Question[]) => void;
  onUpdateAreas: (next: AreaDef[]) => void;
  onUpdateHeroes?: (next: HeroDef[]) => void;
  onUpdateMonsters?: (next: Record<string, MonsterDef>) => void;
  onSelectActiveHero?: (heroId: HeroId) => void;
  onUpdateSettings: (next: GameSettings) => void;
  onUpdateAttempts: (next: AttemptRecord[]) => void;
  onSaveAttemptReview?: (updated: AttemptRecord) => void;
  onDeleteAttempt?: (id: string) => void;
  onResetResults: (alsoResetProfile: boolean) => void;
  onBack: () => void;
}

type TeacherTab = 'bank' | 'dunia' | 'karakter' | 'kelas' | 'laporan';

export const TeacherPanelScreen: React.FC<TeacherPanelScreenProps> = ({
  questions,
  areas,
  heroes = HEROES,
  monsters = MONSTERS,
  activeHeroId = 'ksatria',
  settings,
  attempts,
  hasProfileProgress = false,
  firebaseUser = null,
  isTeacherAdmin = false,
  authLoading = false,
  authError = '',
  onSignInGoogle,
  onSignOutGoogle,
  configSyncStatus = 'unsynced',
  configSyncError = '',
  lastSyncedAt = null,
  attemptsLoading = false,
  onPublishConfigNow,
  onRefreshAttempts,
  onUpdateQuestions,
  onUpdateAreas,
  onUpdateHeroes,
  onUpdateMonsters,
  onSelectActiveHero,
  onUpdateSettings,
  onUpdateAttempts,
  onSaveAttemptReview,
  onDeleteAttempt,
  onResetResults,
  onBack,
}) => {
  // Optional device PIN check
  const [unlocked, setUnlocked] = useState(!settings.teacherPin);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  useEffect(() => {
    if (!settings.teacherPin) {
      setUnlocked(true);
    }
  }, [settings.teacherPin]);

  const [tab, setTab] = useState<TeacherTab>('bank');
  const [searchQuery, setSearchQuery] = useState('');
  const [topicFilter, setTopicFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [confirmClearDemo, setConfirmClearDemo] = useState(false);

  // Manual Question Form Modal
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [showQuestionForm, setShowQuestionForm] = useState(false);

  // CSV / JSON Import Feedback
  const [importStatus, setImportStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  // Area Creator & Editor State
  const [newAreaName, setNewAreaName] = useState('');
  const [newAreaTopic, setNewAreaTopic] = useState('');
  const [newAreaGrade, setNewAreaGrade] = useState('SMA/SMK Kelas X');
  const [newAreaDesc, setNewAreaDesc] = useState('');
  const [newAreaBg, setNewAreaBg] = useState<string>(AREA_BG_IMAGES.castle);
  const [newAreaMonster, setNewAreaMonster] = useState('penjaga_sudut');
  const [editingArea, setEditingArea] = useState<AreaDef | null>(null);
  const [editAreaOldTopic, setEditAreaOldTopic] = useState('');
  const [syncLevelTopics, setSyncLevelTopics] = useState(true);
  const [syncQuestionTopics, setSyncQuestionTopics] = useState(false);

  // Online Room Manager
  const [roomTitle, setRoomTitle] = useState('Kuis Matematika Kelas');
  const [roomTopic, setRoomTopic] = useState('ALL');
  const [roomQCount, setRoomQCount] = useState(5);
  const [activeRoom, setActiveRoom] = useState<OnlineRoomSummary | null>(null);
  const [roomUsingCloud, setRoomUsingCloud] = useState(false);
  const [roomError, setRoomError] = useState('');
  const [roomLoading, setRoomLoading] = useState(false);

  // Essay Grading & Print Report State
  const [gradingAttemptId, setGradingAttemptId] = useState<string | null>(null);
  const [reportClassFilter, setReportClassFilter] = useState('ALL');
  const [reportModeFilter, setReportModeFilter] = useState('ALL');
  const [confirmResetResults, setConfirmResetResults] = useState(false);
  const [resetProfileToo, setResetProfileToo] = useState(true);
  const [resetResultFeedback, setResetResultFeedback] = useState('');
  const [printSheet, setPrintSheet] = useState<{
    mode: 'summary' | 'student';
    attempt?: AttemptRecord;
  } | null>(null);

  const uniqueClasses = useMemo(() => {
    const set = new Set(attempts.map((a) => a.className).filter(Boolean));
    return Array.from(set);
  }, [attempts]);

  const filteredAttempts = useMemo(() => {
    return attempts.filter((a) => {
      const okClass = reportClassFilter === 'ALL' || a.className === reportClassFilter;
      const okMode = reportModeFilter === 'ALL' || a.mode === reportModeFilter;
      return okClass && okMode;
    });
  }, [attempts, reportClassFilter, reportModeFilter]);

  const uniqueTopics = useMemo(() => {
    const set = new Set(questions.map((q) => q.topic));
    areas.forEach((a) => {
      if (a.mathTopic !== 'Campuran & Pengayaan' && a.mathTopic !== 'Campuran & Pengayaan HOTS') {
        set.add(a.mathTopic);
      }
    });
    return Array.from(set);
  }, [questions, areas]);

  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      const matchSearch =
        !searchQuery ||
        q.prompt.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.indicator.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.topic.toLowerCase().includes(searchQuery.toLowerCase());
      const matchTopic = topicFilter === 'ALL' || q.topic === topicFilter;
      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'demo' ? q.isDemo : q.verificationStatus === statusFilter);
      return matchSearch && matchTopic && matchStatus;
    });
  }, [questions, searchQuery, topicFilter, statusFilter]);

  const demoCount = questions.filter((q) => q.isDemo).length;

  // Indicator aggregate across filtered attempts
  const aggregateIndicators = useMemo(() => {
    const map = new Map<string, { topic: string; total: number; correct: number }>();
    filteredAttempts.forEach((att) => {
      att.indicatorStats.forEach((ind) => {
        const cur = map.get(ind.indicator) || { topic: ind.topic, total: 0, correct: 0 };
        cur.total += ind.total;
        cur.correct += ind.correct;
        map.set(ind.indicator, cur);
      });
    });
    return Array.from(map.entries()).map(([indicator, v]) => ({
      indicator,
      topic: v.topic,
      total: v.total,
      correct: v.correct,
      accuracyPct: Math.round((v.correct / Math.max(1, v.total)) * 100),
    }));
  }, [filteredAttempts]);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === settings.teacherPin) {
      setUnlocked(true);
      setPinError('');
    } else {
      setPinError('PIN salah. PIN bawaan perangkat adalah 1234 (dapat diubah di Pengaturan Kelas).');
    }
  };

  const handleDeleteQuestion = (id: string) => {
    onUpdateQuestions(questions.filter((q) => q.id !== id));
  };

  const handleDuplicateQuestion = (q: Question) => {
    const copy: Question = {
      ...q,
      id: `guru-${Date.now()}`,
      prompt: `${q.prompt} (Salinan)`,
      isDemo: false,
      verificationStatus: 'tervalidasi_guru',
    };
    onUpdateQuestions([copy, ...questions]);
  };

  const handleSaveManualQuestion = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const type = fd.get('type') as QuestionType;
    const rawOpts = String(fd.get('options') || '');
    const options =
      type === 'benar_salah'
        ? ['Benar', 'Salah']
        : type === 'pilihan_ganda'
        ? rawOpts
            .split('|')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;

    const correctAnswer = String(fd.get('correctAnswer') || '').trim();
    const numValRaw = String(fd.get('numericValue') || '').trim();
    const numericValue = numValRaw ? Number(numValRaw.replace(',', '.')) : undefined;

    const item: Question = {
      id: editingQuestion?.id || `guru-${Date.now()}`,
      subject: 'Matematika',
      gradeLevel: String(fd.get('gradeLevel') || 'Umum'),
      topic: String(fd.get('topic') || 'Eksponen, Akar & Logaritma'),
      subtopic: String(fd.get('subtopic') || 'Umum'),
      indicator: String(fd.get('indicator') || 'Indikator Pembelajaran'),
      sourceDoc: String(fd.get('sourceDoc') || 'Input Guru'),
      difficulty: (fd.get('difficulty') as Difficulty) || 'sedang',
      type,
      prompt: String(fd.get('prompt') || '').trim(),
      options,
      correctAnswer,
      numericValue: Number.isFinite(numericValue) ? numericValue : undefined,
      unit: String(fd.get('unit') || '').trim() || undefined,
      explanation: String(fd.get('explanation') || '').trim() || `Kunci: ${correctAnswer}`,
      rubric: String(fd.get('rubric') || '').trim() || undefined,
      baseScore: 100,
      estimatedSeconds: 45,
      tags: ['input-guru'],
      verificationStatus: 'tervalidasi_guru',
      isDemo: false,
    };

    if (editingQuestion) {
      onUpdateQuestions(questions.map((q) => (q.id === item.id ? item : q)));
    } else {
      onUpdateQuestions([item, ...questions]);
    }
    setShowQuestionForm(false);
    setEditingQuestion(null);
  };

  const handleCsvJsonImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || '');
      if (file.name.endsWith('.json')) {
        try {
          const parsed = JSON.parse(content);
          if (!Array.isArray(parsed)) {
            setImportStatus({ ok: false, msg: 'Format JSON harus berupa array daftar soal.' });
            return;
          }
          const valid = parsed.filter((item) => item && item.prompt && item.correctAnswer);
          if (valid.length === 0) {
            setImportStatus({ ok: false, msg: 'Tidak ditemukan soal valid dalam file JSON.' });
            return;
          }
          onUpdateQuestions([...valid, ...questions]);
          setImportStatus({ ok: true, msg: `${valid.length} soal JSON berhasil ditambahkan.` });
        } catch {
          setImportStatus({ ok: false, msg: 'File JSON tidak valid. Bank soal lama tetap aman.' });
        }
      } else {
        const res = parseQuestionsFromCsv(content, file.name);
        if (res.questions.length === 0) {
          setImportStatus({ ok: false, msg: res.errors[0] || 'Impor CSV gagal.' });
        } else {
          onUpdateQuestions([...res.questions, ...questions]);
          setImportStatus({
            ok: true,
            msg: `${res.questions.length} soal CSV diimpor.${
              res.errors.length ? ` (${res.errors.length} baris dilewati)` : ''
            }`,
          });
        }
      }
    };
    reader.readAsText(file);
  };

  const AREA_BG_OPTIONS = [
    { label: 'Hutan Rimbun', path: AREA_BG_IMAGES.forest },
    { label: 'Gua Kristal', path: AREA_BG_IMAGES.cavern },
    { label: 'Kastil Batu', path: AREA_BG_IMAGES.castle },
    { label: 'Pegunungan Senja', path: AREA_BG_IMAGES.peaks },
    { label: 'Menara Observatorium', path: AREA_BG_IMAGES.tower },
  ];

  const handleCreateArea = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAreaName.trim() || !newAreaTopic.trim()) return;
    const id = `area-${Date.now()}`;
    const nextOrder = areas.length + 1;
    const newArea: AreaDef = {
      id,
      name: newAreaName.trim(),
      order: nextOrder,
      mathTopic: newAreaTopic.trim(),
      description: newAreaDesc.trim() || `Wilayah petualangan khusus untuk topik ${newAreaTopic.trim()}.`,
      gradeRecommendation: newAreaGrade.trim() || 'Semua Jenjang',
      bgImage: newAreaBg,
      fallbackGradient: 'linear-gradient(180deg, #1e293b 0%, #020617 100%)',
      accentColor: '#38bdf8',
      mapPos: findNonOverlappingPos(areas),
      unlockedByDefault: true,
      isCustom: true,
      levels: [
        {
          id: `${id}-lv1`,
          name: `Tantangan ${newAreaName.trim()}`,
          monsterId: newAreaMonster || 'penjaga_sudut',
          questionCount: 4,
          difficulty: 'campuran',
          topicFilter: newAreaTopic.trim(),
          rewardXp: 120,
          rewardCoins: 45,
        },
      ],
    };
    onUpdateAreas([...areas, newArea]);
    setNewAreaName('');
    setNewAreaTopic('');
    setNewAreaDesc('');
  };

  const handleOpenEditArea = (area: AreaDef) => {
    setEditingArea({
      ...area,
      levels: area.levels.map((l) => ({ ...l })),
    });
    setEditAreaOldTopic(area.mathTopic);
    setSyncLevelTopics(true);
    setSyncQuestionTopics(false);
  };

  const handleSaveEditedArea = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingArea || !editingArea.name.trim() || !editingArea.mathTopic.trim()) return;
    const cleanName = editingArea.name.trim();
    const cleanTopic = editingArea.mathTopic.trim();

    const updatedLevels = editingArea.levels.map((lvl) => {
      if (
        syncLevelTopics &&
        (lvl.topicFilter === editAreaOldTopic || lvl.topicFilter === '') &&
        cleanTopic !== 'Campuran & Pengayaan' &&
        cleanTopic !== 'Campuran & Pengayaan HOTS'
      ) {
        return { ...lvl, topicFilter: cleanTopic };
      }
      return lvl;
    });

    const finalArea: AreaDef = {
      ...editingArea,
      name: cleanName,
      mathTopic: cleanTopic,
      gradeRecommendation: editingArea.gradeRecommendation.trim() || 'Umum',
      description: editingArea.description.trim() || `Wilayah petualangan untuk topik ${cleanTopic}.`,
      levels: updatedLevels,
    };

    onUpdateAreas(areas.map((a) => (a.id === finalArea.id ? finalArea : a)));

    if (syncQuestionTopics && editAreaOldTopic && editAreaOldTopic !== cleanTopic) {
      onUpdateQuestions(
        questions.map((q) =>
          q.topic.toLowerCase() === editAreaOldTopic.toLowerCase()
            ? { ...q, topic: cleanTopic }
            : q
        )
      );
    }

    setEditingArea(null);
  };

  const parseApiJson = async <T,>(res: Response): Promise<T & { error?: string }> => {
    const raw = await res.text();
    try {
      return raw ? (JSON.parse(raw) as T & { error?: string }) : ({} as T & { error?: string });
    } catch {
      throw new Error(
        'Layanan sesi kelas daring (/api/rooms) belum aktif di hosting ini. Pastikan deploy menyertakan Netlify Functions (netlify.toml) atau server backend aktif.'
      );
    }
  };

  useEffect(() => {
    if (!unlocked || tab !== 'laporan' || !onRefreshAttempts) return;
    onRefreshAttempts();
    const poll = window.setInterval(() => {
      onRefreshAttempts();
    }, 8000);
    return () => window.clearInterval(poll);
  }, [unlocked, tab, onRefreshAttempts]);

  useEffect(() => {
    if (!activeRoom || tab !== 'kelas') return;
    if (roomUsingCloud) {
      const unsub = subscribeFirestoreRoomTeacher(
        activeRoom.code,
        (updated) => setActiveRoom(updated),
        (err) =>
          setRoomError(err instanceof Error ? err.message : 'Gagal memantau sesi kelas cloud.')
      );
      return () => unsub();
    }
    if (activeRoom.status === 'ENDED') return;
    const poll = window.setInterval(async () => {
      try {
        const res = await fetch(getApiUrl(`/api/rooms/${activeRoom.code}`));
        if (res.ok) {
          const updated = await res.json();
          setActiveRoom(updated);
        }
      } catch {
        // Ignore transient poll errors
      }
    }, 2500);
    return () => window.clearInterval(poll);
  }, [activeRoom?.code, activeRoom?.status, tab, roomUsingCloud]);

  const handleCreateOnlineRoom = async () => {
    const pool = questions.filter((q) => roomTopic === 'ALL' || q.topic === roomTopic);
    if (pool.length === 0) {
      setRoomError('Tidak ada soal pada topik yang dipilih.');
      return;
    }
    setRoomLoading(true);
    setRoomError('');
    try {
      if (firebaseUser && isTeacherAdmin) {
        const created = await createFirestoreClassroom(
          {
            title: roomTitle,
            areaName: roomTopic === 'ALL' ? 'Semua Topik' : roomTopic,
            topicFilter: roomTopic,
            difficulty: 'campuran',
            questionCount: Math.min(roomQCount, pool.length),
            durationPerQuestionSec: settings.secondsPerQuestion,
            allowHints: settings.allowHints,
            showPublicLeaderboard: settings.showPublicLeaderboard,
            questionPool: pool,
          },
          firebaseUser
        );
        setRoomUsingCloud(true);
        setActiveRoom(created);
        return;
      }

      const res = await fetch(getApiUrl('/api/rooms'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: roomTitle,
          areaName: roomTopic === 'ALL' ? 'Semua Topik' : roomTopic,
          topicFilter: roomTopic,
          difficulty: 'campuran',
          questionCount: Math.min(roomQCount, pool.length),
          durationPerQuestionSec: settings.secondsPerQuestion,
          allowHints: settings.allowHints,
          showPublicLeaderboard: settings.showPublicLeaderboard,
          questionPool: pool,
        }),
      });
      const data = await parseApiJson<OnlineRoomSummary>(res);
      if (!res.ok) setRoomError(data.error || 'Gagal membuat sesi kelas.');
      else {
        setRoomUsingCloud(false);
        setActiveRoom(data);
      }
    } catch (err) {
      setRoomError(
        err instanceof Error ? err.message : 'Server tidak merespons saat membuat ruang kelas.'
      );
    } finally {
      setRoomLoading(false);
    }
  };

  const handleRefreshRoom = async () => {
    if (!activeRoom || roomUsingCloud) return;
    try {
      const res = await fetch(getApiUrl(`/api/rooms/${activeRoom.code}`));
      const data = await parseApiJson<OnlineRoomSummary>(res);
      if (res.ok) setActiveRoom(data);
      else setRoomError(data.error || 'Gagal menyegarkan sesi.');
    } catch (err) {
      setRoomError(err instanceof Error ? err.message : 'Gagal menghubungi server kelas.');
    }
  };

  const handleStartRoom = async () => {
    if (!activeRoom) return;
    try {
      if (roomUsingCloud) {
        await startFirestoreClassroom(activeRoom.code);
        return;
      }
      const res = await fetch(getApiUrl(`/api/rooms/${activeRoom.code}/start`), { method: 'POST' });
      const data = await parseApiJson<OnlineRoomSummary>(res);
      if (res.ok) setActiveRoom(data);
      else setRoomError(data.error || 'Gagal memulai pertandingan.');
    } catch (err) {
      setRoomError(err instanceof Error ? err.message : 'Gagal menghubungi server kelas.');
    }
  };

  const handleEndRoom = async () => {
    if (!activeRoom) return;
    try {
      if (roomUsingCloud) {
        await endFirestoreClassroom(activeRoom.code);
        return;
      }
      const res = await fetch(getApiUrl(`/api/rooms/${activeRoom.code}/end`), { method: 'POST' });
      const data = await parseApiJson<OnlineRoomSummary>(res);
      if (res.ok) setActiveRoom(data);
      else setRoomError(data.error || 'Gagal mengakhiri sesi.');
    } catch (err) {
      setRoomError(err instanceof Error ? err.message : 'Gagal menghubungi server kelas.');
    }
  };

  const handleSaveEssayScore = (attemptId: string, qIdx: number, scorePct: number, note: string) => {
    let updatedTarget: AttemptRecord | null = null;
    const next = attempts.map((att) => {
      if (att.id !== attemptId) return att;
      const updatedLogs = att.questionLogs.map((l, idx) =>
        idx === qIdx
          ? {
              ...l,
              teacherScorePct: scorePct,
              teacherNote: note,
              isCorrect: scorePct >= 60,
              pendingTeacherReview: false,
            }
          : l
      );
      const correctCount = updatedLogs.filter((l) => l.isCorrect).length;
      const mastery = Math.round((correctCount / Math.max(1, updatedLogs.length)) * 100);
      updatedTarget = {
        ...att,
        questionLogs: updatedLogs,
        correctCount,
        academicMasteryPct: mastery,
      };
      return updatedTarget;
    });
    if (updatedTarget && onSaveAttemptReview) {
      onSaveAttemptReview(updatedTarget);
    } else {
      onUpdateAttempts(next);
    }
  };

  const downloadFile = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!unlocked) {
    return (
      <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <form
          onSubmit={handlePinSubmit}
          className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4"
        >
          <div className="flex items-center gap-3">
            <Lock className="w-7 h-7 text-amber-400" />
            <div>
              <h1 className="font-display text-xl font-bold text-white">Akses Panel Guru</h1>
              <p className="text-xs text-slate-400">PIN bawaan perangkat: 1234</p>
            </div>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed bg-slate-950 p-3 rounded-lg border border-slate-800">
            Catatan Privasi: Perlindungan PIN ini bersifat lokal pada perangkat untuk mencegah siswa membuka
            kunci jawaban secara tidak sengaja, bukan keamanan akun server sekolah.
          </p>

          {pinError && <p className="text-xs text-rose-400">{pinError}</p>}

          <input
            type="password"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            placeholder="Masukkan PIN Guru"
            autoFocus
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-center tracking-widest"
          />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onBack}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold cursor-pointer"
            >
              Kembali
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold cursor-pointer"
            >
              Buka Dashboard
            </button>
          </div>
        </form>
      </div>
    );
  }

  const gradingAttempt = attempts.find((a) => a.id === gradingAttemptId);

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="px-5 py-3.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-medium cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Menu Utama</span>
          </button>
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-amber-400" />
            <h1 className="font-display text-lg md:text-xl font-bold text-white">
              Panel Guru & Manajemen Pembelajaran
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800">
          {(
            [
              ['bank', 'Bank Soal'],
              ['dunia', 'Peta & Wilayah'],
              ['karakter', 'Hero & Monster'],
              ['kelas', 'Sesi & Aturan'],
              ['laporan', 'Hasil & Uraian'],
            ] as Array<[TeacherTab, string]>
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                tab === id ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* Server / Firebase Cloud Persistence Status Bar */}
      <div className="px-5 py-2.5 bg-slate-900/75 border-b border-slate-800/90 no-print">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            {!firebaseUser ? (
              <>
                <CloudOff className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong className="text-amber-300">Belum Masuk Akun Google Guru:</strong> Masuk dengan
                  akun Google Anda agar bank soal, wilayah, dan aturan Panel Guru tersimpan di Firebase Cloud
                  dan otomatis tampil untuk semua siswa di perangkat mana pun.
                </span>
              </>
            ) : !isTeacherAdmin ? (
              <>
                <CloudOff className="w-4 h-4 text-sky-400 shrink-0" />
                <span>
                  Masuk sebagai <strong className="text-white">{firebaseUser.email}</strong>. Perubahan
                  lokal tidak menimpa setelan utama guru; hanya akun Google Guru Pemilik yang dapat
                  mempublikasikan ke cloud untuk semua siswa.
                </span>
              </>
            ) : configSyncStatus === 'syncing' || configSyncStatus === 'checking' ? (
              <>
                <Loader2 className="w-4 h-4 text-amber-400 animate-spin shrink-0" />
                <span>
                  {configSyncStatus === 'checking'
                    ? 'Memeriksa sinkronisasi bank soal & pengaturan cloud...'
                    : 'Menyimpan perubahan ke Firebase Cloud...'}
                </span>
              </>
            ) : configSyncStatus === 'synced' ? (
              <>
                <Cloud className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  <strong className="text-emerald-300">Tersinkron Cloud ({firebaseUser.email}):</strong>{' '}
                  Bank soal, wilayah, dan aturan yang Anda buat otomatis aktif saat siswa membuka link ini
                  dengan akun Google mereka.
                  {lastSyncedAt && (
                    <span className="text-slate-400 ml-1.5">
                      (Terakhir disimpan:{' '}
                      {new Date(lastSyncedAt).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      )
                    </span>
                  )}
                </span>
              </>
            ) : configSyncStatus === 'error' ? (
              <>
                <CloudOff className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="text-rose-200">
                  {configSyncError || 'Gagal menyinkronkan ke cloud.'}
                </span>
              </>
            ) : (
              <>
                <Cloud className="w-4 h-4 text-sky-400 shrink-0" />
                <span>
                  Terhubung sebagai Guru ({firebaseUser.email}). Klik tombol di kanan untuk mempublikasikan
                  bank soal &amp; pengaturan saat ini ke semua perangkat siswa.
                </span>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!firebaseUser && onSignInGoogle ? (
              <button
                type="button"
                disabled={authLoading}
                onClick={onSignInGoogle}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 font-bold cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{authLoading ? 'Menghubungkan...' : 'Masuk Akun Google Guru'}</span>
              </button>
            ) : (
              <>
                {isTeacherAdmin && onPublishConfigNow && (
                  <button
                    type="button"
                    disabled={configSyncStatus === 'syncing'}
                    onClick={onPublishConfigNow}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 disabled:opacity-50 text-emerald-200 font-semibold cursor-pointer"
                  >
                    <Cloud className="w-3.5 h-3.5" />
                    <span>Simpan &amp; Publikasikan ke Cloud</span>
                  </button>
                )}
                {onSignOutGoogle && (
                  <button
                    type="button"
                    onClick={onSignOutGoogle}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Ganti Akun</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
        {authError && (
          <div className="max-w-6xl mx-auto mt-2 p-2.5 rounded-lg bg-rose-950/70 border border-rose-500/40 text-xs text-rose-200">
            {authError}
          </div>
        )}
      </div>

      <main className={`flex-1 p-4 md:p-6 max-w-6xl w-full mx-auto space-y-6 overflow-y-auto ${printSheet ? 'no-print' : ''}`}>
        {/* ================= TAB 1: BANK SOAL ================= */}
        {tab === 'bank' && (
          <div className="space-y-5">
            {demoCount > 0 && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/40 flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-amber-100">
                  <strong>Catatan Bank Soal:</strong> Saat ini terdapat{' '}
                  <span className="font-mono font-bold">{demoCount}</span> soal berlabel{' '}
                  <strong>Data Demo (Contoh)</strong> agar game dapat langsung dicoba. Guru dapat mengedit atau
                  menghapus semua data demo setelah mengimpor soal sendiri.
                </div>
                {!confirmClearDemo ? (
                  <button
                    type="button"
                    onClick={() => setConfirmClearDemo(true)}
                    className="px-3.5 py-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/50 text-rose-200 text-xs font-bold cursor-pointer"
                  >
                    Hapus Semua Data Demo
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateQuestions(questions.filter((q) => !q.isDemo));
                        setConfirmClearDemo(false);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold cursor-pointer"
                    >
                      Ya, Hapus {demoCount} Demo
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClearDemo(false)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 text-xs font-semibold cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Action Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingQuestion(null);
                    setShowQuestionForm(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Buat Soal Baru</span>
                </button>

                <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-xs cursor-pointer">
                  <Upload className="w-4 h-4 text-sky-400" />
                  <span>Impor CSV / JSON</span>
                  <input type="file" accept=".csv,.json" className="hidden" onChange={handleCsvJsonImport} />
                </label>

                <button
                  type="button"
                  onClick={() =>
                    downloadFile('template_soal_matematika.csv', generateCsvTemplate(), 'text/csv')
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold text-xs cursor-pointer"
                >
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>Template CSV</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    downloadFile(
                      'cadangan_bank_soal.json',
                      JSON.stringify(questions, null, 2),
                      'application/json'
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold text-xs cursor-pointer"
                >
                  <Download className="w-4 h-4 text-amber-400" />
                  <span>Ekspor JSON</span>
                </button>
              </div>

              <span className="text-xs text-slate-400 font-mono tabular-nums">
                Total: {filteredQuestions.length} / {questions.length} soal
              </span>
            </div>

            {importStatus && (
              <div
                className={`p-3 rounded-xl border text-xs ${
                  importStatus.ok
                    ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                    : 'bg-rose-950/60 border-rose-500/40 text-rose-200'
                }`}
              >
                {importStatus.msg}
              </div>
            )}

            {/* Search & Filter */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari teks soal, indikator, topik..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white"
                />
              </div>
              <select
                value={topicFilter}
                onChange={(e) => setTopicFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white"
              >
                <option value="ALL">Semua Topik</option>
                {uniqueTopics.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white"
              >
                <option value="ALL">Semua Status</option>
                <option value="tervalidasi_guru">Tervalidasi Guru</option>
                <option value="perlu_tinjau">Perlu Ditinjau</option>
                <option value="demo">Data Demo (Contoh)</option>
              </select>
            </div>

            {/* Question List */}
            {filteredQuestions.length === 0 ? (
              <div className="p-10 rounded-2xl bg-slate-900 border border-slate-800 text-center text-sm text-slate-400">
                Belum ada soal yang cocok dengan filter ini. Klik "Buat Soal Baru" atau gunakan "Impor CSV / JSON".
              </div>
            ) : (
              <div className="space-y-3">
                {filteredQuestions.map((q) => (
                  <div key={q.id} className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                      <span>
                        <strong className="text-amber-300">{q.topic}</strong> · {q.type.replace('_', ' ')} ·{' '}
                        <span className="capitalize">{q.difficulty}</span> ·{' '}
                        {q.isDemo ? (
                          <span className="text-sky-300 font-semibold">Data Demo (Contoh)</span>
                        ) : q.isAiGenerated ? (
                          <span className="text-purple-300 font-semibold">Pengembangan AI ({q.verificationStatus})</span>
                        ) : (
                          <span className="text-emerald-300 font-semibold">{q.verificationStatus}</span>
                        )}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingQuestion(q);
                            setShowQuestionForm(true);
                          }}
                          className="text-sky-300 hover:underline font-semibold cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDuplicateQuestion(q)}
                          className="text-slate-300 hover:underline font-semibold cursor-pointer"
                        >
                          Duplikasi
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteQuestion(q.id)}
                          className="text-rose-400 hover:underline font-semibold cursor-pointer"
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-white">{q.prompt}</p>
                    <p className="text-xs text-slate-300">
                      Kunci: <strong className="text-emerald-300">{q.correctAnswer}</strong> · Indikator:{' '}
                      {q.indicator}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 2: KELOLA WILAYAH & MONSTER ================= */}
        {tab === 'dunia' && (
          <div className="space-y-5">
            <WorldMapPositionEditor areas={areas} onUpdateAreas={onUpdateAreas} />

            <form
              onSubmit={handleCreateArea}
              className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4"
            >
              <div>
                <h2 className="font-bold text-lg text-white">Tambah Wilayah Petualangan Baru</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tentukan nama wilayah dan topik materi sesuai kebutuhan kelas, atau klik ikon pensil pada
                  wilayah yang sudah ada untuk mengganti nama dan topiknya.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Nama Wilayah</label>
                  <input
                    type="text"
                    required
                    value={newAreaName}
                    onChange={(e) => setNewAreaName(e.target.value)}
                    placeholder="Mis. Lembah Trigonometri"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Topik Matematika</label>
                  <input
                    type="text"
                    required
                    list="topic-suggestions"
                    value={newAreaTopic}
                    onChange={(e) => setNewAreaTopic(e.target.value)}
                    placeholder="Pilih atau ketik topik baru"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Jenjang / Kelas</label>
                  <input
                    type="text"
                    value={newAreaGrade}
                    onChange={(e) => setNewAreaGrade(e.target.value)}
                    placeholder="Mis. SMA Kelas 10"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Latar Arena</label>
                  <select
                    value={newAreaBg}
                    onChange={(e) => setNewAreaBg(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white"
                  >
                    {AREA_BG_OPTIONS.map((bg) => (
                      <option key={bg.path} value={bg.path}>
                        {bg.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Monster Penjaga Awal</label>
                  <select
                    value={newAreaMonster}
                    onChange={(e) => setNewAreaMonster(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white"
                  >
                    {Object.values(monsters).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.tier})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={newAreaDesc}
                  onChange={(e) => setNewAreaDesc(e.target.value)}
                  placeholder="Deskripsi singkat wilayah..."
                  className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white"
                />
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Wilayah</span>
                </button>
              </div>
            </form>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {areas.map((area) => {
                const count = questions.filter(
                  (q) =>
                    area.mathTopic === 'Campuran & Pengayaan' ||
                    area.mathTopic === 'Campuran & Pengayaan HOTS' ||
                    q.topic.toLowerCase() === area.mathTopic.toLowerCase()
                ).length;

                return (
                  <div key={area.id} className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs text-slate-400">
                          Urutan #{area.order} · {area.gradeRecommendation}
                        </div>
                        <h3 className="font-bold text-base text-white">{area.name}</h3>
                        <p className="text-xs text-amber-300">Topik: {area.mathTopic}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEditArea(area)}
                          className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-sky-300 cursor-pointer"
                          title="Ubah nama wilayah, topik, atau level"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>Ubah</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateAreas(
                              areas.map((a) =>
                                a.id === area.id ? { ...a, unlockedByDefault: !a.unlockedByDefault } : a
                              )
                            )
                          }
                          className="p-2 rounded-lg bg-slate-950 border border-slate-700 text-xs cursor-pointer"
                          title={area.unlockedByDefault ? 'Terbuka sejak awal' : 'Terkunci berurutan'}
                        >
                          {area.unlockedByDefault ? (
                            <Unlock className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Lock className="w-4 h-4 text-amber-400" />
                          )}
                        </button>
                        {areas.length > 1 && (
                          <button
                            type="button"
                            onClick={() => onUpdateAreas(areas.filter((a) => a.id !== area.id))}
                            className="p-2 rounded-lg bg-slate-950 border border-slate-700 text-rose-400 cursor-pointer"
                            title="Hapus wilayah"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="text-xs flex items-center justify-between pt-2 border-t border-slate-800">
                      <span className="text-slate-300 tabular-nums">
                        Jumlah soal cocok: <strong>{count}</strong>
                      </span>
                      {count < 4 && (
                        <span className="text-amber-300 inline-flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> Soal masih sedikit
                        </span>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      {area.levels.map((lvl) => (
                        <div
                          key={lvl.id}
                          className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                        >
                          <span className="font-medium text-slate-200">{lvl.name}</span>
                          <select
                            value={lvl.monsterId}
                            onChange={(e) =>
                              onUpdateAreas(
                                areas.map((a) =>
                                  a.id === area.id
                                    ? {
                                        ...a,
                                        levels: a.levels.map((l) =>
                                          l.id === lvl.id ? { ...l, monsterId: e.target.value } : l
                                        ),
                                      }
                                    : a
                                )
                              )
                            }
                            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-amber-300"
                          >
                            {Object.values(monsters).map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name} ({m.tier})
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= TAB: HERO & MONSTER ================= */}
        {tab === 'karakter' && (
          <HeroMonsterEditorTab
            heroes={heroes}
            monsters={monsters}
            areas={areas}
            activeHeroId={activeHeroId}
            onUpdateHeroes={(next) => onUpdateHeroes?.(next)}
            onUpdateMonsters={(next) => onUpdateMonsters?.(next)}
            onUpdateAreas={onUpdateAreas}
            onSelectActiveHero={(heroId) => onSelectActiveHero?.(heroId)}
          />
        )}

        {/* ================= TAB 4: SESI KELAS & ATURAN GAME ================= */}
        {tab === 'kelas' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Online Class Room Creator */}
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-sky-400" />
                <h2 className="font-bold text-lg text-white">Sesi Kelas Daring (Multiplayer Server)</h2>
              </div>
              <p className="text-xs text-slate-400">
                Buat kode ruang agar siswa dapat bergabung dari perangkat masing-masing melalui menu "Masuk
                Kelas" dan menerima paket soal paralel yang setara.
              </p>

              {!activeRoom ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Judul Sesi</label>
                    <input
                      type="text"
                      value={roomTitle}
                      onChange={(e) => setRoomTitle(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Topik</label>
                      <select
                        value={roomTopic}
                        onChange={(e) => setRoomTopic(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white"
                      >
                        <option value="ALL">Semua Topik</option>
                        {uniqueTopics.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Jumlah Soal</label>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={roomQCount}
                        onChange={(e) => setRoomQCount(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white font-mono"
                      />
                    </div>
                  </div>
                  {roomError && <p className="text-xs text-rose-400">{roomError}</p>}
                  <button
                    type="button"
                    disabled={roomLoading}
                    onClick={handleCreateOnlineRoom}
                    className="w-full py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm cursor-pointer"
                  >
                    {roomLoading ? 'Membuat Ruang...' : 'Buat Kode Sesi Kelas'}
                  </button>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-950 border border-sky-500/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-slate-400">Bagikan Kode Ini ke Siswa</div>
                      <div className="font-mono text-3xl font-bold text-amber-300 tracking-widest">
                        {activeRoom.code}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard?.writeText(activeRoom.code)}
                      className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                      title="Salin kode"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="text-xs text-slate-300 flex items-center justify-between">
                    <span>Status: {activeRoom.status}</span>
                    <span>Peserta bergabung: {activeRoom.participants.length}</span>
                  </div>

                  <div className="max-h-36 overflow-y-auto space-y-1">
                    {activeRoom.participants.map((p) => (
                      <div key={p.id} className="text-xs flex justify-between px-2 py-1 rounded bg-slate-900">
                        <span>{p.name}</span>
                        <span className="font-mono text-emerald-300">
                          {p.score} pts ({p.answeredCount}/{activeRoom.questionCount})
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleRefreshRoom}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs font-semibold cursor-pointer"
                    >
                      Segarkan Peserta
                    </button>
                    {activeRoom.status === 'LOBBY' && (
                      <button
                        type="button"
                        onClick={handleStartRoom}
                        className="px-4 py-1.5 rounded-lg bg-emerald-500 text-slate-950 text-xs font-bold cursor-pointer"
                      >
                        Mulai Pertandingan
                      </button>
                    )}
                    {activeRoom.status === 'ACTIVE' && (
                      <button
                        type="button"
                        onClick={handleEndRoom}
                        className="px-4 py-1.5 rounded-lg bg-rose-500 text-white text-xs font-bold cursor-pointer"
                      >
                        Akhiri Sesi
                      </button>
                    )}
                    {activeRoom.status === 'ENDED' && (
                      <button
                        type="button"
                        onClick={() => setActiveRoom(null)}
                        className="px-4 py-1.5 rounded-lg bg-slate-700 text-white text-xs font-bold cursor-pointer"
                      >
                        Buat Sesi Baru
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Game Rules Configuration */}
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4">
              <h2 className="font-bold text-lg text-white">Aturan Permainan & Penilaian</h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <label className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer">
                  <span>Timer Pertanyaan</span>
                  <input
                    type="checkbox"
                    checked={settings.timerEnabled}
                    onChange={(e) => onUpdateSettings({ ...settings, timerEnabled: e.target.checked })}
                  />
                </label>
                <label className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer">
                  <span>Bantuan & Petunjuk</span>
                  <input
                    type="checkbox"
                    checked={settings.allowHints}
                    onChange={(e) => onUpdateSettings({ ...settings, allowHints: e.target.checked })}
                  />
                </label>
                <label className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer">
                  <span>Kesempatan Kedua</span>
                  <input
                    type="checkbox"
                    checked={settings.allowSecondChance}
                    onChange={(e) => onUpdateSettings({ ...settings, allowSecondChance: e.target.checked })}
                  />
                </label>
                <label className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer">
                  <span>Buka Semua Wilayah</span>
                  <input
                    type="checkbox"
                    checked={settings.unlockAllAreas}
                    onChange={(e) => onUpdateSettings({ ...settings, unlockAllAreas: e.target.checked })}
                  />
                </label>
                <label className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer">
                  <span>Tampilkan Pembahasan</span>
                  <input
                    type="checkbox"
                    checked={settings.showExplanationOnWrong}
                    onChange={(e) =>
                      onUpdateSettings({ ...settings, showExplanationOnWrong: e.target.checked })
                    }
                  />
                </label>
                <label className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer">
                  <span>Peringkat Publik</span>
                  <input
                    type="checkbox"
                    checked={settings.showPublicLeaderboard}
                    onChange={(e) =>
                      onUpdateSettings({ ...settings, showPublicLeaderboard: e.target.checked })
                    }
                  />
                </label>
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Detik/Soal</label>
                  <input
                    type="number"
                    min={15}
                    max={180}
                    value={settings.secondsPerQuestion}
                    onChange={(e) =>
                      onUpdateSettings({ ...settings, secondsPerQuestion: Number(e.target.value) || 45 })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Skor Dasar</label>
                  <input
                    type="number"
                    min={10}
                    max={500}
                    value={settings.baseScore}
                    onChange={(e) =>
                      onUpdateSettings({ ...settings, baseScore: Number(e.target.value) || 100 })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">PIN Guru</label>
                  <input
                    type="text"
                    maxLength={8}
                    value={settings.teacherPin}
                    onChange={(e) => onUpdateSettings({ ...settings, teacherPin: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 5: HASIL BELAJAR & PENILAIAN URAIAN ================= */}
        {tab === 'laporan' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 no-print">
              <div>
                <h2 className="font-bold text-lg text-white">
                  Dashboard Hasil Belajar ({filteredAttempts.length} / {attempts.length} Riwayat Sesi)
                </h2>
                <p className="text-xs text-slate-400">
                  Menampilkan hasil siswa yang bermain melalui menu Mulai Bermain maupun Team Battle Lokal pada link ini.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {onRefreshAttempts && (
                  <button
                    type="button"
                    disabled={attemptsLoading}
                    onClick={onRefreshAttempts}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 disabled:opacity-60 text-sky-200 text-xs font-semibold cursor-pointer"
                  >
                    <RefreshCw className={`w-4 h-4 ${attemptsLoading ? 'animate-spin' : ''}`} />
                    <span>{attemptsLoading ? 'Menyegarkan...' : 'Segarkan Hasil Siswa'}</span>
                  </button>
                )}
                <button
                  type="button"
                  disabled={filteredAttempts.length === 0}
                  onClick={() => setPrintSheet({ mode: 'summary' })}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-45 text-slate-950 text-xs font-bold cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak Laporan Rekap</span>
                </button>
                <button
                  type="button"
                  disabled={filteredAttempts.length === 0}
                  onClick={() => {
                    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
                    const header = [
                      'Nama Siswa/Tim',
                      'Kelas',
                      'Mode',
                      'Wilayah',
                      'Level',
                      'Tanggal',
                      'Nilai Akademik (%)',
                      'Benar',
                      'Total Soal',
                      'Skor Permainan',
                      'Durasi (detik)',
                    ];
                    const rows = filteredAttempts.map((a) => [
                      a.studentName,
                      a.className,
                      a.mode,
                      a.areaName,
                      a.levelName,
                      a.dateIso,
                      a.academicMasteryPct,
                      a.correctCount,
                      a.totalQuestions,
                      a.gameScore,
                      a.durationSec,
                    ]);
                    const csv = '\uFEFF' + [header, ...rows].map((r) => r.map(esc).join(',')).join('\n');
                    downloadFile('laporan_hasil_siswa.csv', csv, 'text/csv;charset=utf-8');
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-45 text-xs font-semibold cursor-pointer"
                >
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>Ekspor CSV</span>
                </button>
                <button
                  type="button"
                  disabled={filteredAttempts.length === 0}
                  onClick={() =>
                    downloadFile(
                      'laporan_hasil_siswa.json',
                      JSON.stringify(filteredAttempts, null, 2),
                      'application/json'
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-45 text-xs font-semibold cursor-pointer"
                >
                  <Download className="w-4 h-4 text-sky-400" />
                  <span>Ekspor JSON</span>
                </button>
                <button
                  type="button"
                  disabled={attempts.length === 0 && !hasProfileProgress}
                  onClick={() => {
                    setConfirmResetResults((v) => !v);
                    setResetResultFeedback('');
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/45 disabled:opacity-40 text-rose-200 text-xs font-bold cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4 text-rose-400" />
                  <span>Reset Data Hasil</span>
                </button>
              </div>
            </div>

            {resetResultFeedback && (
              <div className="p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-500/45 flex items-center justify-between gap-3 text-xs text-emerald-200 no-print">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{resetResultFeedback}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setResetResultFeedback('')}
                  className="text-emerald-300 hover:underline font-semibold cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            )}

            {confirmResetResults && (
              <div className="p-4 rounded-2xl bg-rose-950/45 border border-rose-500/50 space-y-3 no-print">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-1 text-xs">
                    <h3 className="font-bold text-sm text-white">
                      Konfirmasi Reset Data Hasil &amp; Mulai Game dari Awal
                    </h3>
                    <p className="text-rose-100/90 leading-relaxed">
                      Tindakan ini akan menghapus seluruh data <strong>ketuntasan per indikator</strong>,
                      riwayat <strong>nilai &amp; skor siswa</strong>, serta rincian{' '}
                      <strong>jawaban uraian</strong> sehingga laporan kembali kosong seperti baru dimulai.
                      Bank soal, pengaturan wilayah/peta, dan aturan guru tetap aman tersimpan.
                    </p>
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer pl-7">
                  <input
                    type="checkbox"
                    checked={resetProfileToo}
                    onChange={(e) => setResetProfileToo(e.target.checked)}
                  />
                  <span>
                    Sekaligus reset progres permainan di Peta Dunia (XP, Level, Koin, Bintang &amp;
                    wilayah terbuka kembali ke awal)
                  </span>
                </label>

                <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setConfirmResetResults(false)}
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onResetResults(resetProfileToo);
                      setGradingAttemptId(null);
                      setPrintSheet(null);
                      setReportClassFilter('ALL');
                      setReportModeFilter('ALL');
                      setConfirmResetResults(false);
                      setResetResultFeedback(
                        resetProfileToo
                          ? 'Seluruh data ketuntasan per indikator, nilai/skor siswa, dan progres Peta Dunia berhasil direset. Game siap digunakan lagi dari awal.'
                          : 'Seluruh data ketuntasan per indikator serta nilai & skor siswa berhasil dikosongkan.'
                      );
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Ya, Reset Semua Data Hasil</span>
                  </button>
                </div>
              </div>
            )}

            {attempts.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 no-print">
                <select
                  value={reportClassFilter}
                  onChange={(e) => setReportClassFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white"
                >
                  <option value="ALL">Semua Kelas</option>
                  {uniqueClasses.map((c) => (
                    <option key={c} value={c}>
                      Kelas: {c}
                    </option>
                  ))}
                </select>
                <select
                  value={reportModeFilter}
                  onChange={(e) => setReportModeFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white"
                >
                  <option value="ALL">Semua Mode Permainan</option>
                  <option value="solo">Solo Adventure</option>
                  <option value="local_team">Team Battle Lokal</option>
                  <option value="online_class">Kelas Daring</option>
                </select>
              </div>
            )}

            {filteredAttempts.length === 0 ? (
              <div className="p-10 rounded-2xl bg-slate-900 border border-slate-800 text-center text-sm text-slate-400">
                Belum ada riwayat permainan yang cocok. Mainkan minimal satu misi untuk melihat dan mencetak hasil
                pekerjaan siswa di sini.
              </div>
            ) : (
              <>
                {/* Aggregate Indicator Mastery */}
                <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-3">
                  <h3 className="font-bold text-base text-white">Ketuntasan per Indikator</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {aggregateIndicators.map((ind, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                        <div className="font-semibold text-slate-100">{ind.indicator}</div>
                        <div className="mt-1 flex items-center justify-between text-slate-400 tabular-nums">
                          <span>{ind.topic}</span>
                          <span className={ind.accuracyPct >= 75 ? 'text-emerald-400 font-bold' : 'text-amber-300 font-bold'}>
                            {ind.accuracyPct}% ({ind.correct}/{ind.total} soal
                            {ind.total < 3 ? ' · sampel terbatas' : ''})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Attempts Table */}
                <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="p-3">Siswa / Tim</th>
                        <th className="p-3">Kelas</th>
                        <th className="p-3">Wilayah & Level</th>
                        <th className="p-3">Nilai Akademik</th>
                        <th className="p-3">Skor Game</th>
                        <th className="p-3">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 tabular-nums">
                      {filteredAttempts.map((att) => {
                        const hasEssayPending = att.questionLogs.some((l) => l.pendingTeacherReview);
                        return (
                          <tr key={att.id} className="hover:bg-slate-950/60">
                            <td className="p-3 font-semibold text-white">{att.studentName}</td>
                            <td className="p-3 text-slate-300">{att.className}</td>
                            <td className="p-3 text-slate-300">
                              {att.areaName} — {att.levelName}
                            </td>
                            <td className="p-3 font-mono font-bold text-emerald-400">
                              {att.academicMasteryPct}% ({att.correctCount}/{att.totalQuestions})
                            </td>
                            <td className="p-3 font-mono text-amber-300">{att.gameScore}</td>
                            <td className="p-3">
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => setGradingAttemptId(att.id)}
                                  className="text-sky-300 hover:underline font-semibold cursor-pointer"
                                >
                                  {hasEssayPending ? 'Nilai Uraian' : 'Tinjau Rincian'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPrintSheet({ mode: 'student', attempt: att })}
                                  className="inline-flex items-center gap-1 text-amber-300 hover:underline font-semibold cursor-pointer"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                  <span>Cetak</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (onDeleteAttempt) {
                                      onDeleteAttempt(att.id);
                                    } else {
                                      onUpdateAttempts(attempts.filter((item) => item.id !== att.id));
                                    }
                                    if (gradingAttemptId === att.id) setGradingAttemptId(null);
                                  }}
                                  className="inline-flex items-center gap-1 text-rose-400 hover:text-rose-300 font-semibold cursor-pointer"
                                  title="Hapus data siswa ini"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* Essay Grading & Detail Drawer */}
            {gradingAttempt && (
              <div className="rounded-2xl bg-slate-900 border border-sky-500/50 p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-bold text-base text-white">
                    Penilaian & Rincian Pekerjaan: {gradingAttempt.studentName}
                  </h3>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setPrintSheet({ mode: 'student', attempt: gradingAttempt })}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Cetak Hasil Siswa Ini</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setGradingAttemptId(null)}
                      className="text-xs text-slate-400 hover:text-white cursor-pointer"
                    >
                      Tutup
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  {gradingAttempt.questionLogs.map((log, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                      <div className="flex items-center justify-between text-slate-400">
                        <span>
                          Soal {idx + 1} · {log.topic} · {log.indicator}
                        </span>
                        <span className={log.isCorrect ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                          {log.pendingTeacherReview
                            ? 'Menunggu Penilaian'
                            : log.isCorrect
                            ? 'Benar'
                            : 'Belum Tepat'}
                        </span>
                      </div>
                      <div className="font-semibold text-slate-100">{log.prompt}</div>
                      <div className="text-slate-300 flex flex-wrap gap-4">
                        <span>
                          Jawaban Siswa: <strong className="text-white">{log.studentAnswer || '(Kosong)'}</strong>
                        </span>
                        <span>
                          Kunci: <strong className="text-emerald-300">{log.correctAnswer}</strong>
                        </span>
                      </div>
                      {log.type === 'uraian' && (
                        <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center gap-2">
                          <span className="text-sky-300 font-semibold">Beri Nilai Rubrik:</span>
                          {[100, 75, 50, 25, 0].map((pct) => (
                            <button
                              key={pct}
                              type="button"
                              onClick={() =>
                                handleSaveEssayScore(
                                  gradingAttempt.id,
                                  idx,
                                  pct,
                                  log.teacherNote || 'Dinilai guru'
                                )
                              }
                              className={`px-2.5 py-1 rounded font-mono font-bold cursor-pointer ${
                                log.teacherScorePct === pct
                                  ? 'bg-emerald-500 text-slate-950'
                                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                              }`}
                            >
                              {pct}%
                            </button>
                          ))}
                          {!log.pendingTeacherReview && (
                            <span className="text-emerald-400 inline-flex items-center gap-1 ml-2">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Tersimpan
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Manual Question Creator / Editor Modal */}
      {showQuestionForm && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleSaveManualQuestion}
            className="w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-700 p-6 space-y-4 my-auto"
          >
            <h2 className="font-display text-xl font-bold text-white">
              {editingQuestion ? 'Edit Soal Matematika' : 'Buat Soal Matematika Baru'}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">Topik</label>
                <input
                  name="topic"
                  required
                  list="topic-suggestions"
                  defaultValue={editingQuestion?.topic || 'Eksponen, Akar & Logaritma'}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Jenis Soal</label>
                <select
                  name="type"
                  defaultValue={editingQuestion?.type || 'pilihan_ganda'}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white"
                >
                  <option value="pilihan_ganda">Pilihan Ganda</option>
                  <option value="benar_salah">Benar / Salah</option>
                  <option value="isian">Isian Numerik / Teks</option>
                  <option value="uraian">Uraian (Rubrik Guru)</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Kesulitan</label>
                <select
                  name="difficulty"
                  defaultValue={editingQuestion?.difficulty || 'sedang'}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white"
                >
                  <option value="mudah">Mudah</option>
                  <option value="sedang">Sedang</option>
                  <option value="sulit">Sulit</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">Indikator Kompetensi</label>
                <input
                  name="indicator"
                  required
                  defaultValue={editingQuestion?.indicator || ''}
                  placeholder="Contoh: Menghitung luas segitiga"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Jenjang / Sumber</label>
                <input
                  name="gradeLevel"
                  defaultValue={editingQuestion?.gradeLevel || 'SMA/SMK Kelas X'}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Teks Pertanyaan</label>
              <textarea
                name="prompt"
                required
                rows={3}
                defaultValue={editingQuestion?.prompt || ''}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">
                  Opsi Pilihan Ganda (pisahkan dengan |)
                </label>
                <input
                  name="options"
                  defaultValue={editingQuestion?.options?.join('|') || '10|12|14|16'}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Kunci Jawaban</label>
                <input
                  name="correctAnswer"
                  required
                  defaultValue={editingQuestion?.correctAnswer || ''}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">Nilai Numerik (Opsional untuk Isian)</label>
                <input
                  name="numericValue"
                  defaultValue={editingQuestion?.numericValue ?? ''}
                  placeholder="Contoh: 0.75"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Satuan (Opsional)</label>
                <input
                  name="unit"
                  defaultValue={editingQuestion?.unit || ''}
                  placeholder="Contoh: cm²"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Pembahasan Langkah demi Langkah</label>
              <textarea
                name="explanation"
                rows={2}
                defaultValue={editingQuestion?.explanation || ''}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowQuestionForm(false);
                  setEditingQuestion(null);
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold cursor-pointer"
              >
                Simpan Soal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Shared Topic Datalist for Area & Question Forms */}
      <datalist id="topic-suggestions">
        {uniqueTopics.map((t) => (
          <option key={`sug-${t}`} value={t} />
        ))}
      </datalist>

      {/* Edit Area & Topic Modal */}
      {editingArea && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleSaveEditedArea}
            className="w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-700 p-6 space-y-4 my-auto"
          >
            <h2 className="font-display text-xl font-bold text-white">
              Ubah Nama Wilayah, Topik & Level
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">Nama Wilayah</label>
                <input
                  type="text"
                  required
                  value={editingArea.name}
                  onChange={(e) => setEditingArea({ ...editingArea, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Topik Matematika Wilayah</label>
                <input
                  type="text"
                  required
                  list="topic-suggestions"
                  value={editingArea.mathTopic}
                  onChange={(e) => setEditingArea({ ...editingArea, mathTopic: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">Jenjang / Kelas</label>
                <input
                  type="text"
                  value={editingArea.gradeRecommendation}
                  onChange={(e) =>
                    setEditingArea({ ...editingArea, gradeRecommendation: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Urutan di Peta</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={editingArea.order}
                  onChange={(e) =>
                    setEditingArea({ ...editingArea, order: Number(e.target.value) || 1 })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Latar Arena</label>
                <select
                  value={editingArea.bgImage}
                  onChange={(e) => setEditingArea({ ...editingArea, bgImage: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white"
                >
                  {AREA_BG_OPTIONS.map((bg) => (
                    <option key={bg.path} value={bg.path}>
                      {bg.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">Posisi Peta Horizontal X (%)</label>
                <input
                  type="number"
                  min={6}
                  max={94}
                  value={editingArea.mapPos.x}
                  onChange={(e) => {
                    const nextPos = clampMapPos(
                      Number(e.target.value) || 6,
                      editingArea.mapPos.y
                    );
                    setEditingArea({ ...editingArea, mapPos: nextPos });
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Posisi Peta Vertikal Y (%)</label>
                <input
                  type="number"
                  min={10}
                  max={88}
                  value={editingArea.mapPos.y}
                  onChange={(e) => {
                    const nextPos = clampMapPos(
                      editingArea.mapPos.x,
                      Number(e.target.value) || 10
                    );
                    setEditingArea({ ...editingArea, mapPos: nextPos });
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono"
                />
              </div>
            </div>

            <div className="text-xs">
              <label className="block text-slate-300 mb-1">Deskripsi Wilayah</label>
              <textarea
                rows={2}
                value={editingArea.description}
                onChange={(e) => setEditingArea({ ...editingArea, description: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white"
              />
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-slate-200">
                <input
                  type="checkbox"
                  checked={syncLevelTopics}
                  onChange={(e) => setSyncLevelTopics(e.target.checked)}
                />
                <span>Otomatis perbarui filter topik level di wilayah ini mengikuti topik baru</span>
              </label>
              {editAreaOldTopic && editAreaOldTopic !== editingArea.mathTopic.trim() && (
                <label className="flex items-center gap-2 cursor-pointer text-amber-200">
                  <input
                    type="checkbox"
                    checked={syncQuestionTopics}
                    onChange={(e) => setSyncQuestionTopics(e.target.checked)}
                  />
                  <span>
                    Ganti juga topik pada soal bank soal dari "{editAreaOldTopic}" menjadi "
                    {editingArea.mathTopic}"
                  </span>
                </label>
              )}
            </div>

            {/* Level List Editor inside Area */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200">Daftar Level di Wilayah Ini</span>
                <button
                  type="button"
                  onClick={() =>
                    setEditingArea({
                      ...editingArea,
                      levels: [
                        ...editingArea.levels,
                        {
                          id: `${editingArea.id}-lv-${Date.now()}`,
                          name: `Misi Baru ${editingArea.levels.length + 1}`,
                          monsterId: 'slime_angka',
                          questionCount: 4,
                          difficulty: 'campuran',
                          topicFilter: editingArea.mathTopic,
                          rewardXp: 100,
                          rewardCoins: 40,
                        },
                      ],
                    })
                  }
                  className="text-xs font-semibold text-amber-300 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Level</span>
                </button>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {editingArea.levels.map((lvl, lIdx) => (
                  <div
                    key={lvl.id}
                    className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center text-xs"
                  >
                    <input
                      type="text"
                      value={lvl.name}
                      onChange={(e) =>
                        setEditingArea({
                          ...editingArea,
                          levels: editingArea.levels.map((l, i) =>
                            i === lIdx ? { ...l, name: e.target.value } : l
                          ),
                        })
                      }
                      className="sm:col-span-5 px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-white"
                      placeholder="Nama Level"
                    />
                    <input
                      type="text"
                      value={lvl.topicFilter}
                      onChange={(e) =>
                        setEditingArea({
                          ...editingArea,
                          levels: editingArea.levels.map((l, i) =>
                            i === lIdx ? { ...l, topicFilter: e.target.value } : l
                          ),
                        })
                      }
                      className="sm:col-span-4 px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-amber-200"
                      placeholder="Filter Topik"
                    />
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={lvl.questionCount}
                      onChange={(e) =>
                        setEditingArea({
                          ...editingArea,
                          levels: editingArea.levels.map((l, i) =>
                            i === lIdx ? { ...l, questionCount: Number(e.target.value) || 4 } : l
                          ),
                        })
                      }
                      className="sm:col-span-2 px-2 py-1.5 rounded bg-slate-900 border border-slate-700 text-white font-mono"
                      title="Jumlah Soal"
                    />
                    {editingArea.levels.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setEditingArea({
                            ...editingArea,
                            levels: editingArea.levels.filter((_, i) => i !== lIdx),
                          })
                        }
                        className="sm:col-span-1 text-rose-400 hover:text-rose-300 flex justify-center cursor-pointer"
                        title="Hapus level"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingArea(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer"
              >
                Simpan Perubahan Wilayah
              </button>
            </div>
          </form>
        </div>
      )}

      {printSheet && (
        <PrintableReportSheet
          mode={printSheet.mode}
          attempts={filteredAttempts}
          selectedAttempt={printSheet.attempt}
          aggregateIndicators={aggregateIndicators}
          filterLabel={`${reportClassFilter === 'ALL' ? 'Semua Kelas' : reportClassFilter} · ${
            reportModeFilter === 'ALL' ? 'Semua Mode' : reportModeFilter
          }`}
          onClose={() => setPrintSheet(null)}
        />
      )}
    </div>
  );
};
