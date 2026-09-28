import { Typography } from "antd";
import { ClockCircleOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";

interface SectionTimerProps {
  remainingSeconds: number;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function SectionTimer({ remainingSeconds }: SectionTimerProps) {
  const { t } = useTranslation();
  const isLow = remainingSeconds <= 300; // 5 min warning

  return (
    <div className={`timer ${isLow ? "timer-low" : ""}`}>
      <ClockCircleOutlined />
      <div className="timer-text">
        <span className="timer-label">{t("exam.time_remaining")}</span>
        <Typography.Text strong className="timer-value">
          {formatDuration(remainingSeconds)}
        </Typography.Text>
      </div>
    </div>
  );
}
