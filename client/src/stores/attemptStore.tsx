import { notification } from "antd";
import { useTranslation } from "react-i18next";
import { createContext, useContext, useEffect, useReducer, useRef, type ReactNode } from "react";
import { api } from "../api";
import type { AnswerMap, AnswerValue, Attempt, PaperDetail } from "../types";
import { clearLocalState, loadLocalState, saveLocalState } from "../utils/localState";


export interface QuestionReviewResult {
  paperQuestionId: string;
  isCorrect: boolean;
  yourAnswer: unknown;
  correctAnswer: unknown;
  explanation: string | null;
  score: number;
}

interface AttemptState {
  attempt: Attempt | null;
  paper: PaperDetail | null;
  answers: AnswerMap;
  currentIndex: number;
  remainingSeconds: number;
  saving: boolean;
  lastSavedAt: number | null;
  submitted: boolean;
  reviewResults: Record<string, QuestionReviewResult>;
  loading: boolean;
  error: string | null;
}

type Action =
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "SET_DATA"; attempt: Attempt; paper: PaperDetail; answers: AnswerMap; currentIndex: number }
  | { type: "SET_ANSWER"; questionId: string; value: AnswerValue }
  | { type: "SET_INDEX"; index: number }
  | { type: "TICK"; seconds: number }
  | { type: "SET_SAVING"; saving: boolean }
  | { type: "SET_SAVED" }
  | { type: "SET_SUBMITTED"; attempt: Attempt }
  | { type: "SET_REVIEW"; results: Record<string, QuestionReviewResult> }
  | { type: "SET_ERROR"; error: string | null };

const initialState: AttemptState = {
  attempt: null,
  paper: null,
  answers: {},
  currentIndex: 0,
  remainingSeconds: 0,
  saving: false,
  lastSavedAt: null,
  submitted: false,
  reviewResults: {},
  loading: true,
  error: null,
};

function reducer(state: AttemptState, action: Action): AttemptState {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, loading: action.loading };
    case "SET_DATA":
      return {
        ...state,
        attempt: action.attempt,
        paper: action.paper,
        answers: action.answers,
        currentIndex: action.currentIndex,
        loading: false,
        remainingSeconds: Math.max(0, action.paper.durationSeconds - action.attempt.durationUsedSeconds),
      };
    case "SET_ANSWER": {
      const answers = { ...state.answers, [action.questionId]: action.value };
      return { ...state, answers };
    }
    case "SET_INDEX":
      return { ...state, currentIndex: action.index };
    case "TICK": {
      const remaining = Math.max(0, state.remainingSeconds - action.seconds);
      return { ...state, remainingSeconds: remaining };
    }
    case "SET_SAVING":
      return { ...state, saving: action.saving };
    case "SET_SAVED":
      return { ...state, saving: false, lastSavedAt: Date.now() };
    case "SET_SUBMITTED":
      return { ...state, submitted: true, attempt: action.attempt };
    case "SET_REVIEW":
      return { ...state, reviewResults: action.results };
    case "SET_ERROR":
      return { ...state, error: action.error, loading: false };
    default:
      return state;
  }
}

interface AttemptStoreValue extends AttemptState {
  reviewResults: Record<string, QuestionReviewResult>;
  setAnswer: (questionId: string, value: AnswerValue) => void;
  goToIndex: (index: number) => void;
  submit: () => Promise<void>;
}

const AttemptContext = createContext<AttemptStoreValue | null>(null);

/**
 * Loads an existing attempt and its paper.
 * The caller is responsible for creating the attempt first (via api.createAttempt)
 * and passing the resulting attemptId.
 */
export function AttemptProvider({ children, attemptId }: { children: ReactNode; attemptId: string }) {
  const { t } = useTranslation();
  const [state, dispatch] = useReducer(reducer, initialState);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load attempt + paper data
  useEffect(() => {
    let cancelled = false;
    (async () => {
      dispatch({ type: "SET_LOADING", loading: true });
      try {
        const [{ attempt }, localState] = await Promise.all([
          api.getAttempt(attemptId),
          Promise.resolve(loadLocalState(attemptId) as {
            currentIndex: number;
            answers: AnswerMap;
          } | null),
        ]);
        const { paper } = await api.getPaper(attempt.paperId);
        if (!cancelled) {
          dispatch({
            type: "SET_DATA",
            attempt,
            paper,
            answers: localState?.answers ?? {},
            currentIndex: localState?.currentIndex ?? 0,
          });
        }
      } catch (err) {
        if (!cancelled) {
          dispatch({ type: "SET_ERROR", error: err instanceof Error ? err.message : "Failed to load" });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [attemptId]);

  // Countdown timer
  useEffect(() => {
    if (!state.attempt || state.submitted) return;
    tickRef.current = setInterval(() => {
      dispatch({ type: "TICK", seconds: 1 });
    }, 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [state.attempt, state.submitted]);

  // Auto-save (debounced 3s)
  useEffect(() => {
    if (!state.attempt || state.submitted || state.loading) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      dispatch({ type: "SET_SAVING", saving: true });
      try {
        await api.saveAnswers(attemptId, state.answers);
        dispatch({ type: "SET_SAVED" });
      } catch {
        dispatch({ type: "SET_SAVING", saving: false });
      }
    }, 3000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [state.answers, state.attempt, state.submitted, state.loading, attemptId]);

  const setAnswer = (questionId: string, value: AnswerValue) => {
    const answers = { ...state.answers, [questionId]: value };
    dispatch({ type: "SET_ANSWER", questionId, value });
    saveLocalState(attemptId, { currentIndex: state.currentIndex, answers });
  };

  const goToIndex = (index: number) => {
    dispatch({ type: "SET_INDEX", index });
    saveLocalState(attemptId, { currentIndex: index, answers: state.answers });
  };

  const submit = async () => {
    // Flush any pending save
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    try {
      await api.saveAnswers(attemptId, state.answers);
      const { attempt } = await api.submitAttempt(attemptId);
      dispatch({ type: "SET_SUBMITTED", attempt });
      clearLocalState(attemptId);
      notification.success({ message: t("exam.submit_success") });
      // Fetch per-question review results for inline review mode
      try {
        const { report } = await api.getReport(attemptId);
        const reviewMap: Record<string, QuestionReviewResult> = {};
        for (const section of report.sections) {
          for (const result of section.results) {
            reviewMap[result.paperQuestionId] = {
              paperQuestionId: result.paperQuestionId,
              isCorrect: result.isCorrect,
              yourAnswer: result.answer ?? null,
              correctAnswer: result.correctAnswer ?? null,
              explanation: result.explanation ?? null,
              score: result.finalScore ?? 0,
            };
          }
        }
        dispatch({ type: "SET_REVIEW", results: reviewMap });
      } catch {
        notification.warning({ message: t("exam.review_unavailable") });
      }
    } catch (err) {
      notification.error({ message: err instanceof Error ? err.message : "Submit failed" });
    }
  };

  return (
    <AttemptContext.Provider value={{ ...state, setAnswer, goToIndex, submit }}>
      {children}
    </AttemptContext.Provider>
  );
}

export function useAttemptStore() {
  const ctx = useContext(AttemptContext);
  if (!ctx) throw new Error("useAttemptStore must be used within AttemptProvider");
  return ctx;
}
