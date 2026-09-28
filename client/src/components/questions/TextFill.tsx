import { Input } from "antd";
import type { TextFillPayload } from "../../types";
import type { QuestionRendererProps } from "./types";

export default function TextFill({ question, value, onChange, disabled }: QuestionRendererProps) {
  const payload = question.payload as TextFillPayload;
  const text = value?.type === "text" ? value.value : "";

  return (
    <div className="question-body">
      <div className="text-fill-line">
        <span className="text-fill-prefix">{payload.prefix}</span>
        <Input
          value={text}
          onChange={(e) => onChange({ type: "text", value: e.target.value })}
          disabled={disabled}
          style={{ width: 80, display: "inline-block" }}
          className="text-fill-input"
        />
        <span className="text-fill-suffix">{payload.suffix}</span>
      </div>
      {payload.pinyinHint && <div className="text-fill-hint">{payload.pinyinHint}</div>}
    </div>
  );
}
