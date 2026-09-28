import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "../src/i18n/config";
import { AuthProvider } from "../src/auth/AuthContext";
import MainLayout from "../src/layouts/MainLayout";

vi.mock("../src/api", () => ({
  api: {
    getMe: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
  },
  ApiError: class ApiError extends Error {},
}));

import { api } from "../src/api";

const mockGetMe = vi.mocked(api.getMe);

function renderApp() {
  return render(
    <AuthProvider>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={["/zh-CN/banks"]}>
          <Routes>
            <Route path="/:locale/banks" element={<MainLayout />} />
            <Route path="/:locale/login" element={<div>Login Route</div>} />
          </Routes>
        </MemoryRouter>
      </I18nextProvider>
    </AuthProvider>
  );
}

beforeEach(() => {
  void i18n.changeLanguage("zh-CN");
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe("Session expiration", () => {
  it("prompts for re-login when an existing session is no longer valid", async () => {
    window.localStorage.setItem("hsk_session_active", "1");
    mockGetMe.mockResolvedValue({ data: null });

    renderApp();

    await waitFor(() => {
      expect(screen.getByText("登录已过期")).toBeInTheDocument();
    });
    expect(
      screen.getByText("登录无操作超过 2 小时，请重新登录。")
    ).toBeInTheDocument();

    await waitFor(() => {
      screen.getByRole("button", { name: /重新登录/ }).click();
    });

    await waitFor(() => {
      expect(screen.getByText("Login Route")).toBeInTheDocument();
    });
    expect(window.localStorage.getItem("hsk_session_active")).toBeNull();
  });
});
