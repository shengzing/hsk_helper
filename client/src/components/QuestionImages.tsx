import { Image, Spin } from "antd";
import { useEffect, useState } from "react";

interface QuestionImagesProps {
  assetIds: string[];
  attemptId?: string;
  className?: string;
}

/** Loads images from encrypted asset URLs and renders them.
 *  In production, images are fetched with credentials and decrypted client-side.
 *  For now, uses standard img src through the API proxy. */
export default function QuestionImages({ assetIds, attemptId, className }: QuestionImagesProps) {
  const [urls, setUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!assetIds.length) {
      setUrls([]);
      setLoading(false);
      return;
    }
    const baseUrl = attemptId
      ? `/api/attempts/${attemptId}/assets`
      : "/api/assets";
    setUrls(assetIds.map((id) => `${baseUrl}/${id}`));
    setLoading(false);
  }, [assetIds, attemptId]);

  if (loading) return <Spin size="small" />;
  if (!urls.length) return null;

  return (
    <div className={`question-images ${className ?? ""}`}>
      {urls.map((url, idx) => (
        <Image
          key={idx}
          src={url}
          alt={`Question image ${idx + 1}`}
          className="question-image"
          style={{ maxWidth: "100%", border: "1px solid #dfe5ec", borderRadius: 4 }}
          fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
        />
      ))}
    </div>
  );
}
