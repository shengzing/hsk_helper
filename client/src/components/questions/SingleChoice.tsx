import { Radio } from "antd";
import { Typography } from "antd";
import { useTranslation } from "react-i18next";
import type { SingleChoicePayload } from "../../types";
import type { QuestionRendererProps } from "./types";

export default function SingleChoice({ question, value, onChange, disabled, showResult, isCorrect }: QuestionRendererProps) {
  const { t } = useTranslation();
  const payload = question.payload as SingleChoicePayload;
  const selectedKey = value?.type === "choice" ? value.value : undefined;

  return (
    <div className="question-body">
      {question.stem && (
        <Typography.Paragraph className="question-stem">
          {question.stem}
        </Typography.Paragraph>
      )}
      <Radio.Group
        value={selectedKey}
        onChange={(e) => onChange({ type: "choice", value: e.target.value })}
        disabled={disabled}
      >
        <div className="question-options-list">
          {payload.options.map((opt) => {
            const isSelected = selectedKey === opt.key;
            const showCorrect = showResult && isSelected && !isCorrect;
            return (
              <div
                key={opt.key}
                className={`question-option ${isSelected ? "is-selected" : ""} ${showCorrect ? "is-wrong" : ""}`}
              >
                <Radio value={opt.key} disabled={disabled}>
                  <span className="option-label">{opt.key}.</span> {opt.text}
                </Radio>
              </div>
            );
          })}
        </div>
      </Radio.Group>
      {!showResult && !selectedKey && (
        <div className="question-hint">{t("common.empty")}</div>
      )}
    </div>
  );
}
