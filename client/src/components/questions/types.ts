import type { AnswerValue, PaperQuestion } from "../../types";

export interface QuestionRendererProps {
  question: PaperQuestion;
  value: AnswerValue | null;
  onChange: (value: AnswerValue) => void;
  disabled?: boolean;
  showResult?: boolean;
  isCorrect?: boolean;
}
