import { Select } from "antd";
import type { DragFillPayload } from "../../types";
import type { QuestionRendererProps } from "./types";

export default function DragFill({ question, value, onChange, disabled }: QuestionRendererProps) {
  const payload = question.payload as DragFillPayload;
  const selectedKey = value?.type === "fill" ? value.value : undefined;

  // Options come from the parent group payload, not the individual question.
  // For standalone rendering, we accept inline options from context if present.
  const options = (question.payload as DragFillPayload & { options?: { key: string; text: string }[] }).options ?? [];

  return (
    <div className="question-body">
      <div className="drag-fill-context">{payload.context}</div>
      {options.length > 0 && (
        <Select
          value={selectedKey}
          onChange={(v) => onChange({ type: "fill", value: v })}
          disabled={disabled}
          style={{ width: 200 }}
          options={options.map((o) => ({ value: o.key, label: `${o.key}. ${o.text}` }))}
          placeholder="—"
        />
      )}
      {options.length === 0 && selectedKey && (
        <span className="fill-answer-badge">{selectedKey}</span>
      )}
    </div>
  );
}
