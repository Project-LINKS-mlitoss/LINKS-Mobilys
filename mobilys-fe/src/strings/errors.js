// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
/**
 * Japanese error strings (UI-facing).
 *
 * Purpose: collect Japanese error strings shown to users, to keep them consistent
 * and easy to find.
 */

export const ERRORS = {
  auth: {
    logoutFailed: "ログアウトに失敗しました",
  },
  fileUploader: {
    invalidFileTypeTemplate: (extensions) =>
      `無効なファイル形式です。許可されている拡張子: ${extensions}`,
  },
};
