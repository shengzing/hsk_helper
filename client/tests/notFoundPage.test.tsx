import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "../src/i18n/config";
import NotFoundPage from "../src/pages/NotFoundPage";

function renderWithI18n(ui: React.ReactNode) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>{ui}</MemoryRouter>
    </I18nextProvider>
  );
}

describe("NotFoundPage", () => {
  it("renders a 404 status", () => {
    renderWithI18n(<NotFoundPage />);
    expect(screen.getByText("404")).toBeInTheDocument();
  });

  it("renders localized not-found message", () => {
    renderWithI18n(<NotFoundPage />);
    // zh-CN is default; message is "页面不存在"
    expect(screen.getByText("页面不存在")).toBeInTheDocument();
  });
});
