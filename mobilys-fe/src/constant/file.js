// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
/**
 * File upload constants.
 *
 * Purpose: a simple state machine for file upload flow (idle/uploading/success/error)
 * used across components/features.
 */

export const FILE_STATUS = {
  IDLE: "idle",
  UPLOADING: "uploading",
  SUCCESS: "success",
  ERROR: "error",
};
