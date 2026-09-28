import { Button, Card, Input, Progress, Space, Typography } from "antd";
import { ClockCircleOutlined, EyeOutlined, EyeInvisibleOutlined } from "@ant-design/icons";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { EssayPayload } from "../../types";
import type { QuestionRendererProps } from "./types";

const { TextArea } = Input;

export default function Essay({ question, value, onChange, disabled }: QuestionRendererProps) {
  const { t } = useTranslation();
  const payload = question.payload as EssayPayload;
  const text = value?.type === "essay" ? value.value : "";
  const target = payload.targetLength ?? 400;
  const percent = Math.min(100, Math.round((text.length / target) * 100));

  // Reading vs writing phase timer
  const [phase, setPhase] = useState<"reading" | "writing">(payload.readingMinutes ? "reading" : "writing");
  const [readingRemaining, setReadingRemaining] = useState((payload.readingMinutes ?? 0) * 60);
  const [showMaterial, setShowMaterial] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (phase === "reading" && readingRemaining > 0) {
      timerRef.current = setInterval(() => {
        setReadingRemaining((s) => {
          if (s <= 1) {
            setPhase("writing");
            return 0;
          }
          return s - 1;
        });
      }, 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
  }, [phase, readingRemaining]);

  function fmtTime(s: number): string {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, "0")}`;
  }

  return (
    <div className="question-body essay-body">
      {payload.rules && payload.rules.length > 0 && (
        <Card size="small" className="essay-rules-card" title={t("exam.section_writing")}>
          <div className="essay-rules">
            {payload.rules.map((rule, idx) => (
              <div key={idx} className="essay-rule">• {rule}</div>
            ))}
          </div>
          {payload.targetLength && (
            <Typography.Text type="secondary" style={{ marginTop: 8, display: "block" }}>
              {t("common.questions")}: {payload.targetLength}
            </Typography.Text>
          )}
        </Card>
      )}

      {payload.readingMinutes && phase === "reading" && (
        <div className="essay-reading-phase">
          <Space>
            <ClockCircleOutlined />
            <Typography.Text strong>{t("exam.time_remaining")}: {fmtTime(readingRemaining)}</Typography.Text>
            <Button
              type="primary"
              size="small"
              onClick={() => { setPhase("writing"); setShowMaterial(false); }}
            >
              {t("exam.section_writing")}
            </Button>
          </Space>
        </div>
      )}

      {(payload.material ?? payload.materialId) && showMaterial && (
        <Card size="small" className="essay-material" title={t("exam.section_reading")}
          extra={
            <Button
              type="text"
              size="small"
              icon={showMaterial ? <EyeInvisibleOutlined /> : <EyeOutlined />}
              onClick={() => setShowMaterial(!showMaterial)}
            />
          }
        >
          <Typography.Text type="secondary" style={{ whiteSpace: "pre-wrap", display: "block" }}>
            {payload.material ?? t("exam.material_loading")}
          </Typography.Text>
        </Card>
      )}

      <TextArea
        value={text}
        onChange={(e) => onChange({ type: "essay", value: e.target.value })}
        disabled={disabled || phase === "reading"}
        autoSize={{ minRows: 8, maxRows: 20 }}
        showCount
        maxLength={2000}
        placeholder={phase === "reading" ? t("exam.reading_phase_hint") : t("exam.essay_placeholder")}
      />
      <div className="essay-meta">
        <Typography.Text type="secondary">
          {text.length} / {target}
        </Typography.Text>
        <Progress percent={percent} size="small" style={{ width: 120 }} />
      </div>
    </div>
  );
}
