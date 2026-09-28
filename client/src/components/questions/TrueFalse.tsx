import { Button, Space } from "antd";
import type { TrueFalsePayload } from "../../types";
import type { QuestionRendererProps } from "./types";

export default function TrueFalse({ question, value, onChange, disabled }: QuestionRendererProps) {
  const payload = question.payload as TrueFalsePayload;
  const selected = value?.type === "boolean" ? value.value : undefined;

  return (
    <div className="question-body">
      <div className="tf-statement">{payload.displayText}</div>
      <Space>
        <Button
          type={selected === true ? "primary" : "default"}
          disabled={disabled}
          onClick={() => onChange({ type: "boolean", value: true })}
        >
          {payload.trueLabel}
        </Button>
        <Button
          type={selected === false ? "primary" : "default"}
          danger={selected === false}
          disabled={disabled}
          onClick={() => onChange({ type: "boolean", value: false })}
        >
          {payload.falseLabel}
        </Button>
      </Space>
    </div>
  );
}
