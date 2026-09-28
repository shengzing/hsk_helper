import { Card, Typography } from "antd";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ReadOutlined } from "@ant-design/icons";
import AudioPlayer from "./AudioPlayer";
import QuestionImages from "../QuestionImages";
import type { MaterialInfo, QuestionGroupInfo } from "../../types";

interface MaterialPanelProps {
  group: QuestionGroupInfo;
  attemptId: string;
  currentQuestionNumber?: number;
  disabled?: boolean;
}

export default function MaterialPanel({
  group,
  attemptId,
  currentQuestionNumber,
  disabled,
}: MaterialPanelProps) {
  const { locale } = useParams<{ locale: string }>();
  const { t } = useTranslation();
  const isChinese = locale?.startsWith("zh") ?? false;
  const material = group.material;
  const currentQuestionImages = currentQuestionNumber
    ? group.payload?.question_image_asset_ids?.[String(currentQuestionNumber)]
    : undefined;
  const imageAssetIds = currentQuestionImages ?? group.payload?.image_asset_ids ?? [];
  const currentListeningPart = currentQuestionNumber
    ? group.payload?.parts?.find((part) =>
        part.questionNumbers.includes(currentQuestionNumber)
      )
    : undefined;
  const partNumber = currentListeningPart?.partNumber ?? group.payload?.partNumber;
  const partLabel = partNumber ? `第 ${partNumber} 部分` : null;
  const instruction = currentListeningPart?.instruction
    ?? group.instruction
    ?? material?.title;
  const title = (
    <>
      <ReadOutlined /> {partLabel && <>{partLabel} · </>}{instruction}
      {!isChinese && partLabel && (
        <span className="exam-translation-inline">
          {t("exam.part_translation", { number: partNumber ?? 0 })}
        </span>
      )}
    </>
  );

  if (!material) {
    if (!group.instruction) return null;
    return (
      <Card
        className="material-panel"
        size="small"
        title={title}
        styles={{ body: { padding: 0 } }}
      />
    );
  }

  return (
    <Card
      className="material-panel"
      size="small"
      title={title}
    >
      {material.audio && (
        <div className="material-audio">
          <AudioPlayer
            attemptId={attemptId}
            assetId={material.audio.assetId}
            playLimit={material.audio.playLimit}
            startMs={material.audio.startMs}
            endMs={material.audio.endMs}
            materialId={group.id}
            disabled={disabled}
          />
        </div>
      )}
      {material.textContent && (
        <div className="material-text">
          <Typography.Paragraph style={{ whiteSpace: "pre-wrap" }}>{material.textContent}</Typography.Paragraph>
        </div>
      )}
      {material.transcript && (
        <div className="material-transcript">
          <Typography.Paragraph type="secondary" style={{ whiteSpace: "pre-wrap" }}>{material.transcript}</Typography.Paragraph>
        </div>
      )}
      {imageAssetIds.length > 0 && (
        <QuestionImages assetIds={imageAssetIds} attemptId={attemptId} />
      )}
    </Card>
  );
}
