// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import { setupWorker } from "msw";
import { handlers } from "./handlers";

export const worker = setupWorker(...handlers);
