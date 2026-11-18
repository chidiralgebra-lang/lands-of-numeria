import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  HelpCircle,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Sparkles,
  Swords,
  Volume2,
  VolumeX,
  XCircle,
} from 'lucide-react';
import { HEROES, MONSTERS, resolveAreaBgImage } from '../data/worldData';
import {
  AreaDef,
  AttemptRecord,
  GameSettings,
  HeroDef,
  HeroId,
  IndicatorSummary,
  LevelDef,
  LocalTeamConfig,
  MonsterDef,
  PlayerProfile,
  Question,
  QuestionAttemptLog,
} from '../types/game';
import { soundEngine } from '../utils/audioEngine';
import { evaluateAnswer } from '../utils/mathEvaluator';
import { BattleCanvas, BattleCanvasHandle } from './BattleCanvas';
import { GeometryDiagramSvg } from './CharacterSvg';

interface BattleArenaScreenProps {
  mode: 'solo' | 'local_team';
  area: AreaDef;
  level: LevelDef;
  teamConfig?: LocalTeamConfig;
  allQuestions: Question[];
  heroes?: HeroDef[];
  monsters?: Record<string, MonsterDef>;
  nextTarget?: { area: AreaDef; level: LevelDef; isNewArea: boolean } | null;
  isChallengeStage?: boolean;
  profile: PlayerProfile;
  settings: GameSettings;
  onToggleMute: () => void;
  onFinishBattle: (record: AttemptRecord) => void;
  onContinueNext?: (record: AttemptRecord) => void;
  onExitToMap: () => void;
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function isChallengeHotsQuestion(q: Question): boolean {
  return (
    q.difficulty === 'sulit' &&
    (q.id.startsWith('demo-tantangan-') ||
      Boolean(q.tags?.some((t) => {
        const lower = t.toLowerCase();
        return lower === 'dimensi tantangan' || lower === 'hots';
      })))
  );
}

export const BattleArenaScreen: React.FC<BattleArenaScreenProps> = ({
  mode,
  area,
  level,
  teamConfig,
  allQuestions,
  heroes = HEROES,
  monsters = MONSTERS,
  nextTarget: _nextTarget,
  isChallengeStage = false,
  profile,
  settings,
  onToggleMute,
  onFinishBattle,
  onExitToMap,
}) => {
  const canvasRef = useRef<BattleCanvasHandle | null>(null);
  const effectiveIsChallenge = Boolean(
    isChallengeStage || area.id === 'dimensi_tantangan' || level.id === 'dimensi_lv1'
  );

  // Build topic-relevant question pools; enforce HOTS / sulit priority on final level & Dimensi Tantangan
  const { hotsHardPool, otherHardPool, primaryPool, fallbackPool } = useMemo(() => {
    const topicPool = allQuestions.filter(
      (q) => level.topicFilter === 'ALL' || q.topic.toLowerCase() === level.topicFilter.toLowerCase()
    );

    if (effectiveIsChallenge || level.difficulty === 'sulit') {
      const hotsHard = topicPool.filter((q) => isChallengeHotsQuestion(q));
      const otherHard = topicPool.filter((q) => q.difficulty === 'sulit' && !isChallengeHotsQuestion(q));
      const hardTotal = [...hotsHard, ...otherHard];
      const mediumPool = topicPool.filter((q) => q.difficulty === 'sedang');
      const easyPool = topicPool.filter((q) => q.difficulty === 'mudah');

      const primary =
        hardTotal.length > 0 ? hardTotal : mediumPool.length > 0 ? mediumPool : topicPool;
      // Only include medium/easy fallback if hard questions are very scarce (< 4)
      const secondary =
        hardTotal.length >= 4
          ? []
          : hardTotal.length > 0
          ? [...mediumPool, ...(mediumPool.length === 0 ? easyPool : [])]
          : topicPool.filter((q) => !primary.some((p) => p.id === q.id));

      return {
        hotsHardPool: hotsHard,
        otherHardPool: otherHard,
        primaryPool: primary,
        fallbackPool: secondary,
      };
    }

    // Earlier levels: reserve dedicated HOTS challenge questions for the final stage unless pool is empty
    const standardTopicPool = topicPool.filter((q) => !isChallengeHotsQuestion(q));
    const workingPool = standardTopicPool.length > 0 ? standardTopicPool : topicPool;
    const diffFiltered =
      level.difficulty === 'campuran'
        ? workingPool
        : workingPool.filter((q) => q.difficulty === level.difficulty);
    const primary = diffFiltered.length > 0 ? diffFiltered : workingPool;
    const secondary = workingPool.filter((q) => !primary.some((p) => p.id === q.id));
    return {
      hotsHardPool: [] as Question[],
      otherHardPool: [] as Question[],
      primaryPool: primary,
      fallbackPool: secondary,
    };
  }, [allQuestions, level, effectiveIsChallenge]);

  const buildFreshDeck = (lastQuestionId?: string): Question[] => {
    const firstBatch =
      effectiveIsChallenge || level.difficulty === 'sulit'
        ? hotsHardPool.length > 0 || otherHardPool.length > 0
          ? [...shuffleArray(hotsHardPool), ...shuffleArray(otherHardPool)]
          : shuffleArray(primaryPool)
        : shuffleArray(primaryPool);
    const secondBatch = shuffleArray(fallbackPool);
    const combined = [...firstBatch, ...secondBatch];
    if (combined.length > 1 && lastQuestionId && combined[0].id === lastQuestionId) {
      const swapIdx = combined.findIndex((q) => q.id !== lastQuestionId);
      if (swapIdx > 0) {
        [combined[0], combined[swapIdx]] = [combined[swapIdx], combined[0]];
      }
    }
    return combined;
  };

  const monster = monsters[level.monsterId] || monsters.slime_angka || MONSTERS.slime_angka;
  const monsterMaxHp = Math.round(monster.maxHp * settings.monsterHpMultiplier);

  const activeHeroId: HeroId =
    mode === 'local_team' && teamConfig
      ? (undefined as unknown as HeroId)
      : profile.heroId;

  const [questionQueue, setQuestionQueue] = useState<Question[]>(() => buildFreshDeck());
  const [qIndex, setQIndex] = useState(0);
  const currentQuestion = questionQueue[qIndex];

  // Turn management for Local Team Battle
  const currentTeam = mode === 'local_team' ? (qIndex % 2 === 0 ? 'A' : 'B') : 'A';
  const currentHeroDef = useMemo(() => {
    if (mode === 'local_team' && teamConfig) {
      const hid = currentTeam === 'A' ? teamConfig.teamAHero : teamConfig.teamBHero;
      return heroes.find((h) => h.id === hid) || heroes[0];
    }
    return heroes.find((h) => h.id === activeHeroId) || heroes[0];
  }, [mode, teamConfig, currentTeam, activeHeroId, heroes]);

  const [teamPrivacyCurtain, setTeamPrivacyCurtain] = useState(mode === 'local_team');
  const [heroHp, setHeroHp] = useState(currentHeroDef.baseHp);
  const [teamAHp, setTeamAHp] = useState(120);
  const [teamBHp, setTeamBHp] = useState(120);
  const [teamAScore, setTeamAScore] = useState(0);
  const [teamBScore, setTeamBScore] = useState(0);

  const [monsterHp, setMonsterHp] = useState(monsterMaxHp);
  const [score, setScore] = useState(0);
  const [coinsEarned, setCoinsEarned] = useState(0);
  const [streak, setStreak] = useState(0);

  // Question input & feedback state
  const [textAnswer, setTextAnswer] = useState('');
  const [locked, setLocked] = useState(false);
  const [feedback, setFeedback] = useState<{
    isCorrect: boolean;
    pendingTeacherReview?: boolean;
    message: string;
    explanation: string;
    rubric?: string;
  } | null>(null);

  // Assist tools per question
  const [hintRevealed, setHintRevealed] = useState(false);
  const [eliminatedOption, setEliminatedOption] = useState<string | null>(null);
  const [shieldActive, setShieldActive] = useState(false);
  const [secondChanceUsed, setSecondChanceUsed] = useState(false);

  // Timer & Paused / End Modals
  const useTimer = settings.timerEnabled && mode === 'solo';
  const [timeLeft, setTimeLeft] = useState(settings.secondsPerQuestion);
  const [paused, setPaused] = useState(false);
  const [battleOutcome, setBattleOutcome] = useState<'DEFEAT' | null>(null);

  const logsRef = useRef<QuestionAttemptLog[]>([]);
  const battleStartMs = useRef(Date.now());
  const questionStartMs = useRef(Date.now());
  const victoryFinishedRef = useRef(false);
  const latestVictoryFnRef = useRef<() => void>(() => {});

  // Reset per-question UI state
  useEffect(() => {
    setTextAnswer('');
    setLocked(false);
    setFeedback(null);
    setHintRevealed(false);
    setEliminatedOption(null);
    setSecondChanceUsed(false);
    setTimeLeft(settings.secondsPerQuestion);
    questionStartMs.current = Date.now();
    if (mode === 'local_team' && qIndex > 0) {
      setTeamPrivacyCurtain(true);
    }
  }, [qIndex, settings.secondsPerQuestion, mode]);

  // Question countdown timer
  useEffect(() => {
    if (!useTimer || paused || locked || battleOutcome || teamPrivacyCurtain || !currentQuestion) return;
    const id = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(id);
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  });

  // Keyboard shortcuts: Esc Pause, 1-4 MC options, Enter continue
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!battleOutcome) setPaused((p) => !p);
        return;
      }
      if (paused || battleOutcome || teamPrivacyCurtain || !currentQuestion) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === 'Enter' && !e.shiftKey && currentQuestion.type === 'isian' && !locked) {
          e.preventDefault();
          handleSubmitAnswer(textAnswer);
        }
        return;
      }
      if (!locked && (currentQuestion.type === 'pilihan_ganda' || currentQuestion.type === 'benar_salah')) {
        const opts = currentQuestion.options || [];
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= opts.length) {
          const opt = opts[num - 1];
          if (opt !== eliminatedOption) {
            handleSubmitAnswer(opt);
          }
        }
      } else if (locked && e.key === 'Enter') {
        e.preventDefault();
        handleAdvance();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const handleTimeout = () => {
    if (locked || !currentQuestion) return;
    setLocked(true);
    soundEngine.playWrong();
    const dmg = Math.max(8, Math.round(monster.attackPower * 0.75));
    canvasRef.current?.triggerMonsterAttack(dmg, shieldActive);

    if (!shieldActive) {
      if (mode === 'local_team') {
        if (currentTeam === 'A') setTeamAHp((h) => Math.max(0, h - dmg));
        else setTeamBHp((h) => Math.max(0, h - dmg));
      } else {
        setHeroHp((h) => Math.max(0, h - dmg));
      }
    }
    setShieldActive(false);
    setStreak(0);

    logsRef.current.push({
      questionId: currentQuestion.id,
      prompt: currentQuestion.prompt,
      topic: currentQuestion.topic,
      indicator: currentQuestion.indicator,
      type: currentQuestion.type,
      difficulty: currentQuestion.difficulty,
      studentAnswer: '',
      correctAnswer: currentQuestion.correctAnswer,
      isCorrect: false,
      timeSpentSec: settings.secondsPerQuestion,
      usedHint: hintRevealed,
    });

    setFeedback({
      isCorrect: false,
      message: 'Waktu habis! Monster melancarkan serangan ringan.',
      explanation: settings.showExplanationOnWrong ? currentQuestion.explanation : 'Coba lebih cepat pada soal berikutnya.',
    });
  };

  const handleSubmitAnswer = (chosenRaw: string) => {
    if (locked || !currentQuestion) return;
    const trimmed = chosenRaw.trim();
    if (!trimmed) return;

    const evalRes = evaluateAnswer(currentQuestion, trimmed);

    // Optional Second Chance mechanic if enabled and not yet used this question
    if (!evalRes.isCorrect && settings.allowSecondChance && !secondChanceUsed && shieldActive) {
      setSecondChanceUsed(true);
      setShieldActive(false);
      soundEngine.playShield();
      canvasRef.current?.triggerMonsterAttack(0, true);
      setFeedback({
        isCorrect: false,
        message: 'Perisai menangkis serangan! Kamu mendapat 1 kesempatan kedua untuk menjawab soal ini.',
        explanation: 'Periksa kembali langkah perhitunganmu lalu kirim jawaban baru.',
      });
      return;
    }

    setLocked(true);
    const spentSec = Math.max(1, Math.round((Date.now() - questionStartMs.current) / 1000));

    logsRef.current.push({
      questionId: currentQuestion.id,
      prompt: currentQuestion.prompt,
      topic: currentQuestion.topic,
      indicator: currentQuestion.indicator,
      type: currentQuestion.type,
      difficulty: currentQuestion.difficulty,
      studentAnswer: trimmed,
      correctAnswer: currentQuestion.correctAnswer,
      isCorrect: evalRes.isCorrect,
      pendingTeacherReview: evalRes.pendingTeacherReview,
      timeSpentSec: spentSec,
      usedHint: hintRevealed,
    });

    if (evalRes.isCorrect) {
      soundEngine.playHeroAttack(currentHeroDef.attackStyle);
      window.setTimeout(() => soundEngine.playCorrect(), 160);

      const newStreak = streak + 1;
      setStreak(newStreak);
      const isCrit = newStreak >= 2;
      const diffScale =
        currentQuestion.difficulty === 'sulit'
          ? 1.2
          : currentQuestion.difficulty === 'mudah'
          ? 0.9
          : 1;
      const baseDmg = Math.max(18, Math.round(currentHeroDef.baseAttack * diffScale));
      const dmg = isCrit ? Math.round(baseDmg * 1.25) : baseDmg;

      canvasRef.current?.triggerHeroAttack(dmg, currentHeroDef.attackStyle, isCrit);
      setMonsterHp((hp) => Math.max(0, hp - dmg));

      const diffMult =
        settings.difficultyBonus
          ? currentQuestion.difficulty === 'sulit'
            ? 1.5
            : currentQuestion.difficulty === 'sedang'
            ? 1.2
            : 1
          : 1;
      const timeBonus =
        settings.timeBonusEnabled && useTimer ? Math.round((timeLeft / settings.secondsPerQuestion) * 25) : 0;
      const gained = Math.round(settings.baseScore * diffMult) + timeBonus;

      setScore((s) => s + gained);
      setCoinsEarned((c) => c + 10);
      if (mode === 'local_team') {
        if (currentTeam === 'A') setTeamAScore((s) => s + gained);
        else setTeamBScore((s) => s + gained);
      }

      setFeedback({
        isCorrect: true,
        pendingTeacherReview: evalRes.pendingTeacherReview,
        message: evalRes.feedbackText,
        explanation: currentQuestion.explanation,
        rubric: currentQuestion.rubric,
      });
    } else {
      soundEngine.playMonsterAttack();
      window.setTimeout(() => soundEngine.playWrong(), 150);

      setStreak(0);
      const dmg = monster.attackPower;
      const blocked = shieldActive;
      setShieldActive(false);
      canvasRef.current?.triggerMonsterAttack(dmg, blocked);

      if (!blocked) {
        if (mode === 'local_team') {
          if (currentTeam === 'A') setTeamAHp((h) => Math.max(0, h - dmg));
          else setTeamBHp((h) => Math.max(0, h - dmg));
        } else {
          setHeroHp((h) => Math.max(0, h - dmg));
        }
      }

      setFeedback({
        isCorrect: false,
        message: evalRes.feedbackText,
        explanation: settings.showExplanationOnWrong
          ? currentQuestion.explanation
          : 'Jawaban dicatat. Lanjutkan ke tantangan berikutnya!',
      });
    }
  };

  const finalizeAndBuildRecord = (won: boolean): AttemptRecord => {
    const logs = logsRef.current;
    const total = logs.length;
    const correctCount = logs.filter((l) => l.isCorrect && !l.pendingTeacherReview).length;
    const essayPending = logs.filter((l) => l.pendingTeacherReview).length;
    const unansweredCount = logs.filter((l) => !l.studentAnswer).length;
    const wrongCount = Math.max(0, total - correctCount - essayPending - unansweredCount);

    const gradableTotal = Math.max(1, total - essayPending);
    const academicMasteryPct = Math.round((correctCount / gradableTotal) * 100);

    // Aggregate per indicator
    const map = new Map<string, { topic: string; total: number; correct: number }>();
    for (const l of logs) {
      const cur = map.get(l.indicator) || { topic: l.topic, total: 0, correct: 0 };
      cur.total += 1;
      if (l.isCorrect && !l.pendingTeacherReview) cur.correct += 1;
      map.set(l.indicator, cur);
    }
    const indicatorStats: IndicatorSummary[] = Array.from(map.entries()).map(([indicator, v]) => ({
      indicator,
      topic: v.topic,
      total: v.total,
      correct: v.correct,
      accuracyPct: Math.round((v.correct / v.total) * 100),
    }));

    const durationSec = Math.max(1, Math.round((Date.now() - battleStartMs.current) / 1000));
    const xpEarned = won ? level.rewardXp : Math.round(level.rewardXp * 0.4) + correctCount * 10;
    const totalCoins = coinsEarned + (won ? level.rewardCoins : 10);

    return {
      id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      studentName:
        mode === 'local_team' && teamConfig
          ? `${teamConfig.teamAName} vs ${teamConfig.teamBName}`
          : profile.name,
      className: mode === 'local_team' ? 'Team Battle Lokal' : profile.className,
      mode,
      areaId: area.id,
      areaName: area.name,
      levelId: level.id,
      levelName:
        mode === 'local_team' && teamConfig
          ? `Duel Tim: ${teamConfig.teamAName} (${teamAScore}) vs ${teamConfig.teamBName} (${teamBScore})`
          : level.name,
      heroId: currentHeroDef.id,
      dateIso: new Date().toISOString(),
      durationSec,
      totalQuestions: total,
      correctCount,
      wrongCount,
      unansweredCount,
      gameScore: score,
      academicMasteryPct,
      xpEarned,
      coinsEarned: totalCoins,
      wonBattle: won,
      indicatorStats,
      questionLogs: logs,
    };
  };

  const triggerDirectVictoryResults = () => {
    if (victoryFinishedRef.current) return;
    victoryFinishedRef.current = true;
    onFinishBattle(finalizeAndBuildRecord(true));
  };

  latestVictoryFnRef.current = triggerDirectVictoryResults;

  // Directly transition to ResultsScreen after final blow animation when monster HP reaches 0
  useEffect(() => {
    if (monsterHp > 0 || !locked || paused || battleOutcome === 'DEFEAT' || victoryFinishedRef.current) {
      return;
    }
    const animTimer = window.setTimeout(() => {
      soundEngine.playVictory();
      canvasRef.current?.triggerVictory();
    }, 260);
    const resultsTimer = window.setTimeout(() => {
      latestVictoryFnRef.current();
    }, 1050);

    return () => {
      window.clearTimeout(animTimer);
      window.clearTimeout(resultsTimer);
    };
  }, [monsterHp, locked, paused, battleOutcome]);

  const handleAdvance = () => {
    const soloDead = mode === 'solo' && heroHp <= 0;
    const bothTeamsDead = mode === 'local_team' && teamAHp <= 0 && teamBHp <= 0;
    const monsterDead = monsterHp <= 0;

    if (soloDead || bothTeamsDead) {
      soundEngine.playDefeat();
      canvasRef.current?.triggerDefeat();
      setBattleOutcome('DEFEAT');
      return;
    }

    if (monsterDead) {
      soundEngine.playVictory();
      triggerDirectVictoryResults();
      return;
    }

    const nextIdx = qIndex + 1;
    if (nextIdx >= questionQueue.length) {
      const lastId = questionQueue[questionQueue.length - 1]?.id;
      const moreQuestions = buildFreshDeck(lastId);
      if (moreQuestions.length > 0) {
        setQuestionQueue((prev) => [...prev, ...moreQuestions]);
      }
    }
    setQIndex(nextIdx);
  };

  const handleActivateHint = () => {
    if (!currentQuestion || hintRevealed) return;
    soundEngine.playMenuClick();
    setHintRevealed(true);
  };

  const handleEliminateOne = () => {
    if (!currentQuestion || currentQuestion.type !== 'pilihan_ganda' || eliminatedOption) return;
    const wrongOpts = (currentQuestion.options || []).filter((o) => o !== currentQuestion.correctAnswer);
    if (wrongOpts.length > 0) {
      soundEngine.playMenuClick();
      setEliminatedOption(wrongOpts[0]);
    }
  };

  const handleActivateShield = () => {
    if (shieldActive) return;
    soundEngine.playShield();
    setShieldActive(true);
  };

  const handleRetrySameLevel = () => {
    logsRef.current = [];
    battleStartMs.current = Date.now();
    setQuestionQueue(buildFreshDeck());
    setQIndex(0);
    setHeroHp(currentHeroDef.baseHp);
    setTeamAHp(120);
    setTeamBHp(120);
    setTeamAScore(0);
    setTeamBScore(0);
    setMonsterHp(monsterMaxHp);
    setScore(0);
    setCoinsEarned(0);
    setStreak(0);
    setBattleOutcome(null);
    victoryFinishedRef.current = false;
    canvasRef.current?.resetPose();
  };

  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
          <h2 className="text-xl font-bold">Soal Belum Tersedia</h2>
          <p className="text-sm text-slate-300">
            Bank soal untuk topik "{level.topicFilter}" masih kosong. Silakan tambahkan soal melalui Panel Guru.
          </p>
          <button
            type="button"
            onClick={onExitToMap}
            className="px-5 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-sm cursor-pointer"
          >
            Kembali ke Peta
          </button>
        </div>
      </div>
    );
  }

  const displayedHeroHp = mode === 'local_team' ? (currentTeam === 'A' ? teamAHp : teamBHp) : heroHp;
  const displayedHeroMax = mode === 'local_team' ? 120 : currentHeroDef.baseHp;
  const heroHpPct = Math.max(0, Math.round((displayedHeroHp / displayedHeroMax) * 100));
  const monsterHpPct = Math.max(0, Math.round((monsterHp / monsterMaxHp) * 100));

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col">
      {/* Low-occlusion Top HUD */}
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-3 text-sm">
          <span className="font-display font-bold text-amber-300">{area.name}</span>
          <span className="text-slate-500">·</span>
          <span className="text-slate-200 font-medium">{level.name}</span>
          <span className="text-slate-500">·</span>
          <span className="font-mono tabular-nums text-sky-300">
            Soal ke-{qIndex + 1} · Kalahkan hingga HP Monster 0
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs md:text-sm font-mono tabular-nums">
          {mode === 'local_team' && teamConfig ? (
            <div className="flex items-center gap-3">
              <span className={currentTeam === 'A' ? 'text-sky-300 font-bold underline' : 'text-slate-400'}>
                {teamConfig.teamAName}: {teamAScore}
              </span>
              <span className="text-slate-600">|</span>
              <span className={currentTeam === 'B' ? 'text-amber-300 font-bold underline' : 'text-slate-400'}>
                {teamConfig.teamBName}: {teamBScore}
              </span>
            </div>
          ) : (
            <>
              <span className="text-amber-300">Skor: {score}</span>
              <span className="text-emerald-300">Koin: +{coinsEarned}</span>
            </>
          )}

          {useTimer && (
            <span
              className={`inline-flex items-center gap-1 font-bold ${
                timeLeft <= 10 ? 'text-rose-400' : 'text-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              {timeLeft}s
            </span>
          )}

          <button
            type="button"
            onClick={onToggleMute}
            aria-label="Ubah suara"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
          >
            {settings.sfxEnabled || settings.musicEnabled ? (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-rose-400" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setPaused(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 font-sans text-xs font-semibold cursor-pointer"
          >
            <Pause className="w-3.5 h-3.5" />
            <span>Jeda</span>
          </button>
        </div>
      </header>

      {/* Battle Stage (Isolated 60fps Canvas + Non-Hue-Only Perimeter Status Bars) */}
      <div className="relative h-[13.75rem] sm:h-[16.25rem] md:h-[18.125rem] w-full border-b border-slate-800">
        <BattleCanvas
          ref={canvasRef}
          hero={currentHeroDef}
          equippedAccessory={mode === 'solo' ? profile.equippedAccessory : null}
          monster={monster}
          bgImage={resolveAreaBgImage(area.bgImage)}
          fallbackGradient={area.fallbackGradient}
          accentColor={area.accentColor}
          reducedMotion={settings.reducedMotion}
          animationQuality={settings.animationQuality}
        />

        {/* Perimeter HP Status Overlays (no backdrop-filter over active canvas!) */}
        <div className="absolute top-3 left-3 right-3 z-20 flex items-start justify-between gap-4 pointer-events-none">
          {/* Hero / Team HP */}
          <div className="w-48 sm:w-64 bg-slate-950/90 border border-slate-700 rounded-xl p-2.5">
            <div className="flex items-center justify-between text-xs font-bold mb-1">
              <span className="text-sky-300 truncate">
                {mode === 'local_team' && teamConfig
                  ? `Giliran ${currentTeam === 'A' ? teamConfig.teamAName : teamConfig.teamBName}`
                  : `${currentHeroDef.name} (${currentHeroDef.archetype})`}
              </span>
              <span className="font-mono tabular-nums text-slate-200">
                HP: {displayedHeroHp}/{displayedHeroMax}
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-200 ${
                  heroHpPct > 40 ? 'bg-emerald-500' : 'bg-rose-500'
                }`}
                style={{ width: `${heroHpPct}%` }}
              />
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-300">
              <span>Status: {heroHpPct > 40 ? 'SIAP' : 'KRITIS'}</span>
              {shieldActive && <span className="text-sky-300 font-bold">Perisai Aktif</span>}
            </div>
          </div>

          {/* Monster HP */}
          <div className="w-48 sm:w-64 bg-slate-950/90 border border-slate-700 rounded-xl p-2.5 text-right">
            <div className="flex items-center justify-between text-xs font-bold mb-1">
              <span className="font-mono tabular-nums text-slate-200">
                HP: {monsterHp}/{monsterMaxHp}
              </span>
              <span className="text-rose-300 truncate">{monster.name}</span>
            </div>
            <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-rose-500 transition-all duration-200 ml-auto"
                style={{ width: `${monsterHpPct}%` }}
              />
            </div>
            <div className="mt-1 text-[11px] text-slate-300">
              {monster.tier === 'boss' ? 'Ancaman Bos Wilayah' : 'Monster Penjaga'} · ATK {monster.attackPower}
            </div>
          </div>
        </div>
      </div>

      {/* Lower Question & Action Panel */}
      <main className="flex-1 bg-slate-950 p-4 md:p-6 overflow-y-auto">
        <div className="max-w-4xl mx-auto space-y-4">

          {/* Turn Privacy Curtain for Local Team Battle */}
          {teamPrivacyCurtain && teamConfig ? (
            <div className="rounded-2xl bg-slate-900 border border-amber-400/50 p-8 text-center space-y-4 hc-surface">
              <Eye className="w-10 h-10 text-amber-400 mx-auto" />
              <h2 className="font-display text-2xl font-bold text-white">
                Giliran {currentTeam === 'A' ? teamConfig.teamAName : teamConfig.teamBName}
              </h2>
              <p className="text-sm text-slate-300 max-w-md mx-auto">
                Pastikan tim lawan tidak melihat layar. Klik tombol di bawah jika anggota tim sudah siap menjawab
                soal ke-{qIndex + 1}.
              </p>
              <button
                type="button"
                onClick={() => {
                  questionStartMs.current = Date.now();
                  setTeamPrivacyCurtain(false);
                }}
                className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm cursor-pointer"
              >
                Buka Soal Sekarang
              </button>
            </div>
          ) : (
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 md:p-6 space-y-4 hc-surface">
              {/* Question Metadata (unboxed typography, zero pills) */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                <span>
                  {currentQuestion.topic} · {currentQuestion.indicator} ·{' '}
                  <strong className="text-amber-300 capitalize">{currentQuestion.difficulty}</strong>
                  {effectiveIsChallenge && (
                    <>
                      {' · '}
                      <strong className="text-rose-300">Tantangan Akhir (HOTS)</strong>
                    </>
                  )}
                </span>
                <span>Sumber: {currentQuestion.sourceDoc}</span>
              </div>

              {/* Question Prompt & Optional Geometry Diagram */}
              <div className="flex flex-col md:flex-row items-start justify-between gap-4">
                <p className="text-lg md:text-xl font-bold text-white leading-relaxed flex-1">
                  {currentQuestion.prompt}
                </p>
                {currentQuestion.diagramType && (
                  <GeometryDiagramSvg
                    type={currentQuestion.diagramType}
                    data={currentQuestion.diagramData}
                  />
                )}
              </div>

              {/* Assist Tools (if enabled by teacher) */}
              {settings.allowHints && !locked && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={hintRevealed}
                    onClick={handleActivateHint}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-sky-300 disabled:opacity-45 cursor-pointer"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>{hintRevealed ? 'Petunjuk Terbuka' : 'Petunjuk Langkah'}</span>
                  </button>

                  {currentQuestion.type === 'pilihan_ganda' && (
                    <button
                      type="button"
                      disabled={Boolean(eliminatedOption)}
                      onClick={handleEliminateOne}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-amber-300 disabled:opacity-45 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Eliminasi 1 Opsi</span>
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={shieldActive}
                    onClick={handleActivateShield}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-emerald-300 disabled:opacity-45 cursor-pointer"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>{shieldActive ? 'Perisai Siaga' : 'Aktifkan Perisai'}</span>
                  </button>
                </div>
              )}

              {hintRevealed && !locked && (
                <div className="p-3 rounded-xl bg-sky-950/60 border border-sky-500/40 text-sm text-sky-100">
                  <strong>Petunjuk:</strong>{' '}
                  {currentQuestion.explanation.split('.')[0]}.
                </div>
              )}

              {/* Answer Input Area */}
              {(currentQuestion.type === 'pilihan_ganda' || currentQuestion.type === 'benar_salah') && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {(currentQuestion.options || []).map((opt, idx) => {
                    const isEliminated = opt === eliminatedOption;
                    const isCorrectOpt = locked && opt === currentQuestion.correctAnswer;
                    return (
                      <button
                        key={opt}
                        type="button"
                        disabled={locked || isEliminated}
                        onClick={() => handleSubmitAnswer(opt)}
                        className={`min-h-[3rem] px-4 py-3 rounded-xl border text-left font-semibold text-base transition-all flex items-center justify-between gap-3 cursor-pointer hc-button ${
                          isEliminated
                            ? 'bg-slate-950/40 border-slate-800 text-slate-600 line-through cursor-not-allowed'
                            : isCorrectOpt
                            ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                            : 'bg-slate-950 hover:bg-slate-800 border-slate-700 text-white disabled:cursor-default'
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded-lg bg-slate-800 text-amber-300 font-mono text-xs font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <span>{opt}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {currentQuestion.type === 'isian' && (
                <div className="space-y-3 pt-1">
                  <div className="flex flex-wrap gap-1.5">
                    {['/', ',', '.', '-', '²', '√', 'π', '%'].map((sym) => (
                      <button
                        key={sym}
                        type="button"
                        disabled={locked}
                        onClick={() => setTextAnswer((v) => v + sym)}
                        className="w-9 h-9 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 font-mono text-sm font-bold text-amber-300 cursor-pointer"
                      >
                        {sym}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      disabled={locked}
                      value={textAnswer}
                      onChange={(e) => setTextAnswer(e.target.value)}
                      placeholder={`Ketik jawaban${currentQuestion.unit ? ` (${currentQuestion.unit})` : ''}...`}
                      className="flex-1 px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white text-base font-mono focus:outline-none focus:border-amber-400"
                    />
                    <button
                      type="button"
                      disabled={locked || !textAnswer.trim()}
                      onClick={() => handleSubmitAnswer(textAnswer)}
                      className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Swords className="w-4 h-4" />
                      <span>Serang!</span>
                    </button>
                  </div>
                </div>
              )}

              {currentQuestion.type === 'uraian' && (
                <div className="space-y-3 pt-1">
                  <textarea
                    rows={3}
                    disabled={locked}
                    value={textAnswer}
                    onChange={(e) => setTextAnswer(e.target.value)}
                    placeholder="Tuliskan langkah perhitungan dan jawaban lengkapmu di sini..."
                    className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-amber-400"
                  />
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-400">
                      Soal uraian akan ditinjau guru berdasarkan rubrik (tidak dinilai otomatis sepihak).
                    </span>
                    <button
                      type="button"
                      disabled={locked || !textAnswer.trim()}
                      onClick={() => handleSubmitAnswer(textAnswer)}
                      className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-sm cursor-pointer"
                    >
                      Kirim Uraian
                    </button>
                  </div>
                </div>
              )}

              {/* Immediate Feedback & Step-by-step Explanation */}
              {feedback && (
                <div
                  className={`p-4 rounded-xl border space-y-2 ${
                    feedback.pendingTeacherReview
                      ? 'bg-sky-950/60 border-sky-500/50'
                      : feedback.isCorrect
                      ? 'bg-emerald-950/60 border-emerald-500/50'
                      : 'bg-rose-950/60 border-rose-500/50'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-base">
                    {feedback.isCorrect ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                    )}
                    <span className="text-white">{feedback.message}</span>
                  </div>
                  <p className="text-sm text-slate-200 leading-relaxed">
                    <strong>Pembahasan:</strong> {feedback.explanation}
                  </p>
                  {feedback.rubric && (
                    <p className="text-xs text-sky-200 bg-slate-950/60 p-2.5 rounded-lg">
                      <strong>Rubrik Penilaian Guru:</strong> {feedback.rubric}
                    </p>
                  )}

                  {locked && (
                    <div className="pt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={handleAdvance}
                        className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm inline-flex items-center gap-2 cursor-pointer"
                      >
                        <Play className="w-4 h-4 fill-slate-950" />
                        <span>
                          {monsterHp <= 0
                            ? isChallengeStage
                              ? 'Monster Terakhir Kalah! Menuju Penobatan...'
                              : 'Monster Kalah! Membuka Laporan Hasil...'
                            : (mode === 'solo' && heroHp <= 0) ||
                              (mode === 'local_team' && teamAHp <= 0 && teamBHp <= 0)
                            ? 'Lihat Hasil Pertarungan'
                            : 'Lanjutkan Pertarungan (Enter)'}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Pause Modal */}
      {paused && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-6 space-y-4 text-center">
            <h2 className="font-display text-2xl font-bold text-white">Permainan Dijeda</h2>
            <p className="text-sm text-slate-300">Ambil napas sejenak sebelum melanjutkan misi matematika.</p>
            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                onClick={() => setPaused(false)}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm cursor-pointer"
              >
                Lanjutkan Bermain
              </button>
              <button
                type="button"
                onClick={() => {
                  setPaused(false);
                  handleRetrySameLevel();
                }}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-sm cursor-pointer"
              >
                Ulangi Level
              </button>
              <button
                type="button"
                onClick={onExitToMap}
                className="w-full py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 font-semibold text-sm cursor-pointer"
              >
                Keluar ke Peta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Defeat Summary Modal */}
      {battleOutcome === 'DEFEAT' && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-amber-400/50 p-6 space-y-4 text-center">
            <h2 className="font-display text-2xl font-bold text-amber-300">
              Hampir Berhasil!
            </h2>
            <p className="text-sm text-slate-200 leading-relaxed">
              HP hero habis kali ini, namun semua hasil belajarmu tetap aman. Kamu bisa mencoba lagi atau melihat pembahasan untuk berlatih.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={handleRetrySameLevel}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Coba Lagi</span>
              </button>
              <button
                type="button"
                onClick={() => onFinishBattle(finalizeAndBuildRecord(false))}
                className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm cursor-pointer"
              >
                Lihat Laporan Hasil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
