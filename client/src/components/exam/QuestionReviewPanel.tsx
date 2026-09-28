import { CheckCircleFilled, CloseCircleFilled } from "@ant-design/icons";
import { Typography } from "antd";
import type { QuestionReviewResult } from "../../stores/attemptStore";

interface QuestionReviewPanelProps {
  review: QuestionReviewResult;
}

interface EssayAnswer {
  referenceEssay?: string;
  rubrics?: Array<{ criterion: string; weight: number }>;
}

function isEssayAnswer(value: unknown): value is EssayAnswer {
  return (
    typeof value === "object" &&
    value !== null &&
    "rubrics" in value
  );
}

function formatAnswer(value: unknown): { label: string; text: string; isSubjective: boolean; essay?: EssayAnswer } {
  if (value === null || value === undefined) {
    return { label: "正确答案", text: "—", isSubjective: false };
  }

  // Essay / subjective question
  if (isEssayAnswer(value)) {
    return {
      label: "参考答案",
      text: value.referenceEssay || "本题为主观题，暂无参考范文",
      isSubjective: true,
      essay: value,
    };
  }

  // Single choice / objective question
  if (typeof value === "object" && "value" in (value as Record<string, unknown>)) {
    return {
      label: "正确答案",
      text: String((value as { value: unknown }).value),
      isSubjective: false,
    };
  }

  return { label: "正确答案", text: String(value), isSubjective: false };
}

function formatUserAnswer(value: unknown): string {
  if (value === null || value === undefined) return "未作答";
  if (typeof value === "object" && "value" in (value as Record<string, unknown>)) {
    const inner = (value as { value: unknown }).value;
    if (typeof inner === "string" && inner.length > 0) {
      return inner.length > 80 ? inner.slice(0, 80) + "…" : inner;
    }
    return String(inner);
  }
  return String(value);
}

export default function QuestionReviewPanel({ review }: QuestionReviewPanelProps) {
  const isCorrect = review.isCorrect;
  const correct = formatAnswer(review.correctAnswer);

  return (
    <div className={`question-review-panel ${isCorrect ? "correct" : "wrong"}`}>
      <div className="question-review-row">
        {isCorrect ? (
          <CheckCircleFilled style={{ color: "#52c41a", fontSize: 18 }} />
        ) : (
          <CloseCircleFilled style={{ color: "#ff4d4f", fontSize: 18 }} />
        )}
        <Typography.Text strong>
          {isCorrect ? "答对" : "答错"}
        </Typography.Text>
        {!correct.isSubjective && (
          <Typography.Text type="secondary">
            得分：{review.score}
          </Typography.Text>
        )}
        {correct.isSubjective && (
          <Typography.Text type="secondary">
            主观题 · 人工评分
          </Typography.Text>
        )}
      </div>

      <div className="question-review-row">
        <span className="question-review-label">你的答案：</span>
        <span className="question-review-value">{formatUserAnswer(review.yourAnswer)}</span>
      </div>

      <div className="question-review-row">
        <span className="question-review-label">{correct.label}：</span>
        <span
          className="question-review-value"
          style={{
            color: correct.isSubjective ? "#595959" : "#52c41a",
            fontWeight: correct.isSubjective ? 400 : 600,
          }}
        >
          {correct.text}
        </span>
      </div>

      {/* Show rubrics for subjective questions */}
      {correct.essay?.rubrics && correct.essay.rubrics.length > 0 && (
        <div className="question-review-rubrics">
          <span className="review-label">评分标准</span>
          {correct.essay.rubrics.map((rubric, idx) => (
            <div key={idx} className="rubric-item">
              {rubric.criterion}（{Math.round(rubric.weight * 100)}%）
            </div>
          ))}
        </div>
      )}

      {review.explanation && (
        <div className="question-review-explanation">
          <span className="review-label">解析</span>
          {review.explanation}
        </div>
      )}
    </div>
  );
}
