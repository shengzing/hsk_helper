import { Button, Slider, Typography } from "antd";
import { PauseOutlined, PlayCircleOutlined, SoundOutlined } from "@ant-design/icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api";
import { formatCountdown } from "../../utils/format";

interface AudioPlayerProps {
  attemptId: string;
  assetId: string;
  materialId?: string;
  playLimit?: number;
  startMs?: number;
  endMs?: number;
  disabled?: boolean;
}

export default function AudioPlayer({
  attemptId,
  assetId,
  materialId,
  playLimit = 1,
  startMs,
  endMs,
  disabled,
}: AudioPlayerProps) {
  const { t } = useTranslation();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [playCount, setPlayCount] = useState(0);
  const [playbackCounted, setPlaybackCounted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const audioUrl = `/api/attempts/${attemptId}/assets/${assetId}`;
  const reachedLimit = playCount >= playLimit;
  const isDisabled = disabled || (reachedLimit && !playbackCounted);
  const startSeconds = startMs !== undefined ? startMs / 1000 : 0;
  const effectiveDuration = endMs !== undefined
    ? (endMs - (startMs ?? 0)) / 1000
    : duration;

  const logEvent = useCallback(
    async (eventType: "play" | "pause" | "ended", positionMs: number) => {
      try {
        await api.logAudioEvent(attemptId, {
          assetId,
          materialId,
          eventType,
          positionMs,
        });
      } catch {
        // best-effort audit log
      }
    },
    [attemptId, assetId, materialId],
  );

  const handlePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || isDisabled) return;

    const shouldRestart = startMs !== undefined && (
      audio.currentTime < startSeconds ||
      (endMs !== undefined && audio.currentTime * 1000 >= endMs)
    );
    if (shouldRestart) audio.currentTime = startSeconds;
    void audio.play();
    setPlaying(true);
    if (!playbackCounted) {
      setPlayCount((c) => c + 1);
      setPlaybackCounted(true);
    }
    void logEvent("play", audio.currentTime * 1000);
  }, [startMs, startSeconds, endMs, isDisabled, playbackCounted, logEvent]);

  const handlePause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    setPlaying(false);
    void logEvent("pause", audio.currentTime * 1000);
  }, [logEvent]);

  function handleSeek(percent: number) {
    const audio = audioRef.current;
    if (!audio || effectiveDuration <= 0 || !Number.isFinite(effectiveDuration)) {
      return;
    }

    const nextTime = startSeconds + (percent / 100) * effectiveDuration;
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
    setProgress(percent);
  }

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      const total = endMs !== undefined
        ? (endMs - (startMs ?? 0)) / 1000
        : audio.duration;
      if (total > 0) setProgress(((audio.currentTime - (startMs ?? 0)) / total) * 100);
      if (endMs !== undefined && audio.currentTime * 1000 >= endMs) {
        audio.pause();
        setPlaying(false);
        setPlaybackCounted(false);
        void logEvent("ended", endMs);
      }
    };
    const onLoadedMetadata = () => {
      setDuration(audio.duration);
      if (startMs !== undefined && audio.currentTime < startSeconds) {
        audio.currentTime = startSeconds;
        setCurrentTime(startSeconds);
      }
    };
    const onEnded = () => {
      setPlaying(false);
      setProgress(100);
      setPlaybackCounted(false);
      void logEvent("ended", audio.currentTime * 1000);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
    };
  }, [startMs, startSeconds, endMs, logEvent]);

  return (
    <div className="audio-player">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      <div className="audio-controls">
        {playing ? (
          <Button
            icon={<PauseOutlined />}
            onClick={handlePause}
            disabled={disabled}
            shape="circle"
            size="large"
          />
        ) : (
          <Button
            icon={<PlayCircleOutlined />}
            onClick={handlePlay}
            disabled={isDisabled}
            type="primary"
            shape="circle"
            size="large"
          />
        )}
        <div className="audio-info">
          <div className="audio-time">
            {formatCountdown(Math.floor(currentTime))} / {formatCountdown(Math.floor(duration))}
          </div>
          <Slider
            className="audio-progress"
            value={Math.round(progress * 10) / 10}
            min={0}
            max={100}
            step={0.1}
            disabled={disabled || effectiveDuration <= 0 || !Number.isFinite(effectiveDuration)}
            onChange={handleSeek}
            tooltip={{ formatter: (value) => formatCountdown(Math.floor(((value ?? 0) / 100) * effectiveDuration)) }}
            styles={{ track: { borderRadius: 999 }, handle: {} }}
          />
        </div>
      </div>
      <Typography.Text type="secondary" className="audio-play-count">
        <SoundOutlined /> {t("exam.audio_play_limit", { used: playCount, limit: playLimit })}
      </Typography.Text>
    </div>
  );
}
