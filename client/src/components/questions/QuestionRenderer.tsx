import type { ComponentType } from "react";
import type { HskQuestionType } from "../../types";
import type { QuestionRendererProps } from "./types";
import DragFill from "./DragFill";
import Essay from "./Essay";
import SingleChoice from "./SingleChoice";
import Sorting from "./Sorting";
import TextFill from "./TextFill";
import TrueFalse from "./TrueFalse";
import WordReorder from "./WordReorder";

const renderers: Partial<Record<HskQuestionType, ComponentType<QuestionRendererProps>>> = {
  single_choice: SingleChoice,
  true_false: TrueFalse,
  sorting: Sorting,
  word_reorder: WordReorder,
  drag_fill: DragFill,
  text_fill: TextFill,
  essay: Essay,
};

export default function QuestionRenderer(props: QuestionRendererProps) {
  const Renderer = renderers[props.question.questionType];
  if (!Renderer) {
    return <div>Unknown question type: {props.question.questionType}</div>;
  }
  return <Renderer {...props} />;
}
