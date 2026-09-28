import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "../src/i18n/config";
import AudioPlayer from "../src/components/exam/AudioPlayer";

vi.mock("../src/api", () => ({
  api: {
    logAudioEvent: vi.fn().mockResolvedValue({}),
  },
  ApiError: class ApiError extends Error {
    code: string;
    status: number;
    constructor(code: string, message: string, status: number) {
      super(message);
      this.code = code;
      this.status = status;
    }
  },
}));

function renderWithI18n(ui: React.ReactNode) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

beforeEach(() => {
  void i18n.changeLanguage("zh-CN");
  vi.clearAllMocks();
});

describe("AudioPlayer", () => {
  const defaultProps = {
    attemptId: "attempt-1",
    assetId: "asset-1",
    playLimit: 2,
  };

  it("renders a play button initially", () => {
    renderWithI18n(<AudioPlayer {...defaultProps} />);
    const playButton = screen.getByRole("button");
    expect(playButton).toBeInTheDocument();
    expect(playButton).not.toBeDisabled();
  });

  it("displays play count limit text", () => {
    renderWithI18n(<AudioPlayer {...defaultProps} />);
    // i18n key: exam.audio_play_limit with {{used}}/{{limit}} → "播放次数：0/2"
    expect(screen.getByText((c) => c.includes("0") && c.includes("2"))).toBeInTheDocument();
  });

  it("renders an audio element", () => {
    const { container } = renderWithI18n(<AudioPlayer {...defaultProps} />);
    const audio = container.querySelector("audio");
    expect(audio).toBeTruthy();
    expect(audio?.getAttribute("src")).toContain("/api/attempts/attempt-1/assets/asset-1");
  });

  it("disables play button when disabled prop is true", () => {
    renderWithI18n(<AudioPlayer {...defaultProps} disabled={true} />);
    const buttons = screen.getAllByRole("button");
    const playButton = buttons.find((b) => !b.hasAttribute("aria-label") || b.getAttribute("aria-label") === "");
    // All buttons should be disabled when disabled=true
    expect(buttons.every((b) => b.hasAttribute("disabled") || b.closest("button")?.disabled)).toBe(true);
  });

  it("renders with materialId and segment params", () => {
    renderWithI18n(
      <AudioPlayer
        attemptId="att-2"
        assetId="asset-2"
        materialId="mat-1"
        playLimit={1}
        startMs={5000}
        endMs={30000}
      />
    );
    const audio = document.querySelector("audio");
    expect(audio).toBeTruthy();
    expect(screen.getByText(/0\/1|播放次数/)).toBeInTheDocument();
  });

  it("allows pausing after the play limit has been consumed", () => {
    const { container } = renderWithI18n(
      <AudioPlayer {...defaultProps} playLimit={1} />
    );
    const audio = container.querySelector("audio") as HTMLAudioElement;
    audio.play = vi.fn();
    audio.pause = vi.fn();
    Object.defineProperty(audio, "duration", { value: 120, configurable: true });
    act(() => {
      fireEvent(audio, new Event("loadedmetadata"));
    });

    fireEvent.click(screen.getByRole("button"));
    const pauseButton = screen.getByRole("button");
    expect(pauseButton).not.toBeDisabled();
    expect(screen.getByRole("slider")).not.toBeDisabled();

    fireEvent.click(pauseButton);
    expect(audio.pause).toHaveBeenCalled();

    const resumeButton = screen.getByRole("button");
    expect(resumeButton).not.toBeDisabled();
    fireEvent.click(resumeButton);
    expect(audio.play).toHaveBeenCalledTimes(2);
  });

  it("supports seeking with a full-width slider", async () => {
    const { container } = renderWithI18n(<AudioPlayer {...defaultProps} />);
    const audio = container.querySelector("audio") as HTMLAudioElement;
    Object.defineProperty(audio, "duration", { value: 120, configurable: true });
    act(() => {
      fireEvent(audio, new Event("loadedmetadata"));
    });

    const sliderRoot = container.querySelector(".ant-slider") as HTMLElement;
    sliderRoot.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      right: 100,
      bottom: 16,
      width: 100,
      height: 16,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    act(() => {
      fireEvent.mouseDown(sliderRoot, { clientX: 50, button: 0 });
      fireEvent.mouseUp(window, { clientX: 50 });
    });
    expect(audio.currentTime).toBeGreaterThan(0);

    const progressRoot = container.querySelector(".audio-progress");
    expect(progressRoot).toBeTruthy();
    expect(progressRoot).toHaveClass("audio-progress");
  });
});
