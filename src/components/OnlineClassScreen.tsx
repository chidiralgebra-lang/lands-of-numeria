import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Loader2,
  LogIn,
  Swords,
  Trophy,
  Users,
  XCircle,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import { HEROES } from '../data/worldData';
import { HeroDef, HeroId, OnlineRoomSummary, Question } from '../types/game';
import { soundEngine } from '../utils/audioEngine';
import { getApiUrl } from '../utils/api';
import {
  FirestoreParticipantDoc,
  FirestoreRoomDoc,
  FirestoreRoomQuestion,
  assignParallelQuestions,
  joinFirestoreClassroom,
  submitFirestoreRoomAnswer,
  subscribeFirestoreRoomStudent,
} from '../utils/firebaseSync';
import { HeroPortraitSvg } from './CharacterSvg';

interface OnlineClassScreenProps {
  defaultName: string;
  defaultHero: HeroId;
  heroes?: HeroDef[];
  firebaseUser?: User | null;
  authLoading?: boolean;
  onSignInGoogle?: () => void;
  onBack: () => void;
}

interface SafeRoomQuestion {
  id: string;
  topic: string;
  indicator: string;
  difficulty: 'mudah' | 'sedang' | 'sulit';
  type: Question['type'];
  prompt: string;
  options?: string[];
  unit?: string;
  explanation: string;
}

interface RoomState extends OnlineRoomSummary {
  startedAtMs: number | null;
  serverTimeMs: number;
  myQuestions: SafeRoomQuestion[];
}

export const OnlineClassScreen: React.FC<OnlineClassScreenProps> = ({
  defaultName,
  defaultHero,
  heroes = HEROES,
  firebaseUser = null,
  authLoading = false,
  onSignInGoogle,
  onBack,
}) => {
  const [codeInput, setCodeInput] = useState('');
  const [nameInput, setNameInput] = useState(defaultName);
  const [heroId, setHeroId] = useState<HeroId>(defaultHero);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [cloudRoomMeta, setCloudRoomMeta] = useState<FirestoreRoomDoc | null>(null);
  const [cloudParticipant, setCloudParticipant] = useState<FirestoreParticipantDoc | null>(null);
  const [usingCloudRoom, setUsingCloudRoom] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [qIndex, setQIndex] = useState(0);
  const [textAnswer, setTextAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [answerFeedback, setAnswerFeedback] = useState<{
    isCorrect: boolean;
    correctAnswer: string;
    explanation: string;
  } | null>(null);

  const parseRoomJson = async (res: Response) => {
    const raw = await res.text();
    try {
      return raw ? JSON.parse(raw) : {};
    } catch {
      throw new Error('Layanan sesi kelas daring (/api/rooms) belum aktif di server hosting.');
    }
  };

  const fetchRoomSnapshot = async (code: string, pid: string) => {
    try {
      const res = await fetch(getApiUrl(`/api/rooms/${code}?participantId=${encodeURIComponent(pid)}`));
      if (res.ok) {
        const data = (await res.json()) as RoomState;
        setRoom(data);
      }
    } catch {
      // Ignore transient network poll error
    }
  };

  useEffect(() => {
    if (!room?.code || !participantId) return;
    if (usingCloudRoom && cloudRoomMeta) {
      const unsub = subscribeFirestoreRoomStudent(
        room.code,
        participantId,
        cloudRoomMeta.showPublicLeaderboard,
        ({ room: nextMeta, me: nextMe, participants }) => {
          setCloudRoomMeta(nextMeta);
          if (nextMe) setCloudParticipant(nextMe);
          const qIds =
            nextMe?.assignedQuestionIds?.length
              ? nextMe.assignedQuestionIds
              : nextMeta.status === 'ACTIVE'
              ? assignParallelQuestions(
                  nextMeta.questionPool,
                  nextMeta.questionCount,
                  nextMe?.joinedOrder ?? 0
                )
              : [];
          const myQuestions: SafeRoomQuestion[] = qIds
            .map((qid) => nextMeta.questionPool.find((q) => q.id === qid))
            .filter((q): q is FirestoreRoomQuestion => Boolean(q))
            .map(({ correctAnswer: _c, acceptedAlternatives: _a, numericValue: _n, ...safeQ }) => safeQ);

          setRoom({
            code: nextMeta.code,
            title: nextMeta.title,
            areaName: nextMeta.areaName,
            topicFilter: nextMeta.topicFilter,
            difficulty: nextMeta.difficulty,
            questionCount: nextMeta.questionCount,
            durationPerQuestionSec: nextMeta.durationPerQuestionSec,
            allowHints: nextMeta.allowHints,
            showPublicLeaderboard: nextMeta.showPublicLeaderboard,
            status: nextMeta.status,
            createdAt: nextMeta.createdAt,
            startedAtMs: nextMeta.startedAtMs,
            serverTimeMs: Date.now(),
            participants: participants.map((p) => ({
              id: p.id,
              name: p.name,
              heroId: p.heroId,
              score: p.score,
              correctCount: p.correctCount,
              answeredCount: p.answeredCount,
              connected: p.connected,
            })),
            myQuestions,
          });
        },
        (err) => {
          setErrorMsg(err instanceof Error ? err.message : 'Gagal menyinkronkan ruang kelas cloud.');
        }
      );
      return () => unsub();
    }

    const evtSource = new EventSource(getApiUrl(`/api/rooms/${room.code}/stream`));
    evtSource.onmessage = () => {
      fetchRoomSnapshot(room.code, participantId);
    };
    const poll = window.setInterval(() => {
      fetchRoomSnapshot(room.code, participantId);
    }, 2500);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchRoomSnapshot(room.code, participantId);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      evtSource.close();
      window.clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [room?.code, participantId, usingCloudRoom, cloudRoomMeta?.showPublicLeaderboard]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = codeInput.trim().toUpperCase();
    if (!cleanCode || !nameInput.trim()) {
      setErrorMsg('Isi kode kelas dan nama panggilan terlebih dahulu.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      if (firebaseUser && firebaseUser.emailVerified) {
        const { room: cloudMeta, participant } = await joinFirestoreClassroom(
          cleanCode,
          nameInput.trim(),
          heroId,
          firebaseUser
        );
        setUsingCloudRoom(true);
        setCloudRoomMeta(cloudMeta);
        setCloudParticipant(participant);
        setParticipantId(participant.id);
        const myQuestions: SafeRoomQuestion[] = participant.assignedQuestionIds
          .map((qid) => cloudMeta.questionPool.find((q) => q.id === qid))
          .filter((q): q is FirestoreRoomQuestion => Boolean(q))
          .map(({ correctAnswer: _c, acceptedAlternatives: _a, numericValue: _n, ...safeQ }) => safeQ);
        setRoom({
          code: cloudMeta.code,
          title: cloudMeta.title,
          areaName: cloudMeta.areaName,
          topicFilter: cloudMeta.topicFilter,
          difficulty: cloudMeta.difficulty,
          questionCount: cloudMeta.questionCount,
          durationPerQuestionSec: cloudMeta.durationPerQuestionSec,
          allowHints: cloudMeta.allowHints,
          showPublicLeaderboard: cloudMeta.showPublicLeaderboard,
          status: cloudMeta.status,
          createdAt: cloudMeta.createdAt,
          startedAtMs: cloudMeta.startedAtMs,
          serverTimeMs: Date.now(),
          participants: [
            {
              id: participant.id,
              name: participant.name,
              heroId: participant.heroId,
              score: participant.score,
              correctCount: participant.correctCount,
              answeredCount: participant.answeredCount,
              connected: participant.connected,
            },
          ],
          myQuestions,
        });
        soundEngine.playMenuClick();
        return;
      }

      const res = await fetch(getApiUrl(`/api/rooms/${cleanCode}/join`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameInput.trim(), heroId }),
      });
      const data = await parseRoomJson(res);
      if (!res.ok) {
        setErrorMsg(data.error || 'Gagal bergabung ke kelas.');
      } else {
        setUsingCloudRoom(false);
        setParticipantId(data.participantId);
        setRoom(data.room);
        soundEngine.playMenuClick();
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Tidak dapat terhubung ke server kelas.'
      );
    } finally {
      setLoading(false);
    }
  };

  const currentQuestion = room?.myQuestions?.[qIndex];

  const handleSubmitOnlineAnswer = async (ans: string) => {
    if (!room || !participantId || !currentQuestion || submitting || answerFeedback) return;
    const trimmed = ans.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setErrorMsg('');
    try {
      if (usingCloudRoom && cloudRoomMeta && cloudParticipant) {
        const targetQuestion = cloudRoomMeta.questionPool.find(
          (q) => q.id === currentQuestion.id
        );
        if (!targetQuestion) {
          throw new Error('Soal tidak ditemukan dalam paket kelas.');
        }
        const result = await submitFirestoreRoomAnswer(
          room.code,
          cloudParticipant,
          targetQuestion,
          trimmed
        );
        setCloudParticipant(result.updatedParticipant);
        if (result.isCorrect) soundEngine.playCorrect();
        else soundEngine.playWrong();
        setAnswerFeedback({
          isCorrect: result.isCorrect,
          correctAnswer: result.correctAnswer,
          explanation: result.explanation,
        });
        return;
      }

      const res = await fetch(getApiUrl(`/api/rooms/${room.code}/answer`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantId,
          questionId: currentQuestion.id,
          answer: trimmed,
        }),
      });
      const data = await parseRoomJson(res);
      if (!res.ok) {
        setErrorMsg(data.error || 'Gagal mengirim jawaban.');
      } else {
        if (data.isCorrect) soundEngine.playCorrect();
        else soundEngine.playWrong();
        setAnswerFeedback({
          isCorrect: data.isCorrect,
          correctAnswer: data.correctAnswer,
          explanation: data.explanation,
        });
        fetchRoomSnapshot(room.code, participantId);
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Koneksi terputus saat mengirim jawaban. Coba kirim ulang.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleNextOnlineQuestion = () => {
    setAnswerFeedback(null);
    setTextAnswer('');
    setQIndex((i) => i + 1);
  };

  const me = room?.participants.find((p) => p.id === participantId);

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 p-4 md:p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-sm font-medium cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali</span>
          </button>
          <span className="text-xs text-slate-400">Mode Kelas Daring (Sinkronisasi Server Aktif)</span>
        </div>

        {!room ? (
          <form
            onSubmit={handleJoin}
            className="max-w-lg mx-auto rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-5"
          >
            <div>
              <h1 className="font-display text-2xl font-bold text-white">Gabung Sesi Kelas Daring</h1>
              <p className="text-sm text-slate-400 mt-1">
                Masukkan 6 karakter kode sesi dari Panel Guru untuk bertanding bersama teman sekelas dengan
                paket soal paralel.
              </p>
            </div>

            {!firebaseUser && onSignInGoogle && (
              <div className="p-3.5 rounded-xl bg-sky-950/50 border border-sky-500/40 flex flex-wrap items-center justify-between gap-3 text-xs">
                <span className="text-sky-100 flex-1 min-w-[12rem]">
                  Masuk dengan akun Google Anda agar dapat bergabung ke sesi kelas dari perangkat mana pun.
                </span>
                <button
                  type="button"
                  disabled={authLoading}
                  onClick={onSignInGoogle}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold cursor-pointer disabled:opacity-50"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>{authLoading ? 'Menghubungkan...' : 'Masuk Google'}</span>
                </button>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-xs text-rose-200">
                {errorMsg}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Kode Kelas</label>
                <input
                  type="text"
                  maxLength={8}
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                  placeholder="Contoh: AB12CD"
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-lg tracking-widest uppercase focus:outline-none focus:border-sky-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nama Panggilan</label>
                <input
                  type="text"
                  maxLength={32}
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-sky-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Pilih Hero</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {heroes.map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => setHeroId(h.id)}
                      className={`p-2 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 cursor-pointer ${
                        heroId === h.id
                          ? 'bg-sky-500/20 border-sky-400 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      <HeroPortraitSvg heroId={h.visualId || h.id} className="w-10 h-10" />
                      <span>{h.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
              <span>{loading ? 'Menghubungkan...' : 'Masuk ke Ruang Kelas'}</span>
            </button>
          </form>
        ) : (
          <div className="space-y-6">
            {/* Room Header */}
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-xs text-sky-400 font-semibold">
                  Kode Kelas: <span className="font-mono text-amber-300">{room.code}</span> · {room.areaName}
                </div>
                <h1 className="font-display text-2xl font-bold text-white">{room.title}</h1>
              </div>
              <div className="flex items-center gap-4 text-sm font-mono tabular-nums">
                <span className="text-emerald-400">Skorku: {me?.score ?? 0}</span>
                <span className="text-slate-300">Peserta: {room.participants.length}</span>
              </div>
            </div>

            {room.status === 'LOBBY' && (
              <div className="rounded-2xl bg-slate-900 border border-slate-800 p-8 text-center space-y-3">
                <Clock className="w-10 h-10 text-amber-400 mx-auto" />
                <h2 className="font-display text-xl font-bold text-white">Menunggu Guru Memulai Sesi</h2>
                <p className="text-sm text-slate-300">
                  Kamu sudah terdaftar sebagai <strong>{me?.name}</strong>. Pertanyaan akan muncul otomatis saat
                  guru menekan tombol mulai.
                </p>
              </div>
            )}

            {room.status === 'ACTIVE' && currentQuestion && (
              <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>
                    Soal {qIndex + 1} dari {room.myQuestions.length} · {currentQuestion.topic}
                  </span>
                  <span className="capitalize text-amber-300">{currentQuestion.difficulty}</span>
                </div>
                <p className="text-lg font-bold text-white">{currentQuestion.prompt}</p>

                {errorMsg && (
                  <div className="p-2.5 rounded-lg bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200">
                    {errorMsg}
                  </div>
                )}

                {currentQuestion.options && currentQuestion.options.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {currentQuestion.options.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        disabled={submitting || Boolean(answerFeedback)}
                        onClick={() => handleSubmitOnlineAnswer(opt)}
                        className="p-3.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-left font-semibold text-white cursor-pointer disabled:opacity-60"
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      disabled={submitting || Boolean(answerFeedback)}
                      value={textAnswer}
                      onChange={(e) => setTextAnswer(e.target.value)}
                      placeholder="Ketik jawabanmu..."
                      className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                    />
                    <button
                      type="button"
                      disabled={submitting || Boolean(answerFeedback) || !textAnswer.trim()}
                      onClick={() => handleSubmitOnlineAnswer(textAnswer)}
                      className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm inline-flex items-center gap-2 cursor-pointer"
                    >
                      <Swords className="w-4 h-4" />
                      <span>Kirim</span>
                    </button>
                  </div>
                )}

                {answerFeedback && (
                  <div
                    className={`p-4 rounded-xl border space-y-2 ${
                      answerFeedback.isCorrect
                        ? 'bg-emerald-950/60 border-emerald-500/50'
                        : 'bg-rose-950/60 border-rose-500/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold">
                      {answerFeedback.isCorrect ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <XCircle className="w-5 h-5 text-rose-400" />
                      )}
                      <span>
                        {answerFeedback.isCorrect
                          ? 'Tepat sekali!'
                          : `Belum tepat. Kunci: ${answerFeedback.correctAnswer}`}
                      </span>
                    </div>
                    <p className="text-sm text-slate-200">{answerFeedback.explanation}</p>
                    <div className="pt-1 flex justify-end">
                      <button
                        type="button"
                        onClick={handleNextOnlineQuestion}
                        className="px-4 py-2 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs cursor-pointer"
                      >
                        {qIndex + 1 >= room.myQuestions.length ? 'Lihat Klasemen Akhir' : 'Soal Berikutnya'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {(room.status === 'ENDED' ||
              (room.status === 'ACTIVE' && qIndex >= (room.myQuestions?.length || 0))) && (
              <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
                <div className="flex items-center gap-2 text-amber-300 font-display text-xl font-bold">
                  <Trophy className="w-5 h-5" />
                  <span>
                    {room.status === 'ENDED'
                      ? 'Sesi Kelas Selesai'
                      : 'Semua Soalmu Telah Terjawab!'}
                  </span>
                </div>
                <p className="text-sm text-slate-300 tabular-nums">
                  Skor Akhir: <strong>{me?.score ?? 0}</strong> · Benar:{' '}
                  <strong>
                    {me?.correctCount ?? 0}/{me?.answeredCount ?? 0}
                  </strong>
                </p>

                {room.showPublicLeaderboard ? (
                  <div className="space-y-2 pt-2">
                    <h3 className="text-xs font-bold text-slate-400">Papan Peringkat Kelas</h3>
                    {room.participants.map((p, idx) => (
                      <div
                        key={p.id}
                        className={`p-3 rounded-xl border flex items-center justify-between text-sm ${
                          p.id === participantId
                            ? 'bg-sky-500/15 border-sky-400'
                            : 'bg-slate-950 border-slate-800'
                        }`}
                      >
                        <span>
                          <strong className="font-mono text-amber-300 mr-2">#{idx + 1}</strong>
                          {p.name}
                        </span>
                        <span className="font-mono tabular-nums text-emerald-300">
                          {p.score} pts ({p.correctCount} benar)
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">
                    Peringkat publik disembunyikan oleh guru untuk menjaga kenyamanan belajar siswa.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
