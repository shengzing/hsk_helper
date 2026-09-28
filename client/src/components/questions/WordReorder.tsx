import { Button, Tag } from "antd";
import { CloseOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import type { WordReorderPayload } from "../../types";
import type { QuestionRendererProps } from "./types";

export default function WordReorder({ question, value, onChange, disabled }: QuestionRendererProps) {
  const { t } = useTranslation();
  const payload = question.payload as WordReorderPayload;
  const selected = value?.type === "word_order" ? value.value : [];
  const remaining = payload.words.filter((w) => !selected.includes(w));

  function addWord(word: string) {
    onChange({ type: "word_order", value: [...selected, word] });
  }

  function removeWord(index: number) {
    onChange({ type: "word_order", value: selected.filter((_, i) => i !== index) });
  }

  return (
    <div className="question-body">
      <div className="word-reorder-selected">
        {selected.map((word, idx) => (
          <Tag key={`${word}-${idx}`} closable={!disabled} onClose={() => removeWord(idx)} className="word-chip">
            {word}
          </Tag>
        ))}
        {payload.punctuation && <span className="word-punctuation">{payload.punctuation}</span>}
      </div>
      {selected.length > 0 && !disabled && (
        <Button size="small" type="link" onClick={() => onChange({ type: "word_order", value: [] })}>
          {t("common.cancel")}
        </Button>
      )}
      <div className="word-reorder-pool">
        {remaining.map((word) => (
          <Button
            key={word}
            size="small"
            disabled={disabled}
            onClick={() => addWord(word)}
            className="word-chip"
          >
            {word}
          </Button>
        ))}
      </div>
    </div>
  );
}
