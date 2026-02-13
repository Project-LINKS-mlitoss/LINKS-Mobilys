// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import { rest } from "msw";

export const handlers = [
  rest.post("/api/gtfs/data/import/api", async (req, res, ctx) => {
    const { organization_id, feed_id } = await req.json();

    // Simulate a delay to mimic network latency
    ctx.delay(2000);

    // Simulate error for specific organization_id and feed_id
    if (organization_id === "gan-wu" || feed_id === "shiokazeline") {
      return res(
        ctx.status(400),
        ctx.json({ detail: "フィードIDが見つかりません" })
      );
    }

    return res(
      ctx.status(200),
      ctx.json({
        message: "Upload successful",
        filename: "gtfs.feed_may2025.zip",
        status: "processing",
      })
    );
  }),
  rest.post("/api/gtfs/data/import/local", async (req, res, ctx) => {
    return res(
      ctx.delay(2000),
      ctx.status(400),
      ctx.json({
        detail: "ローカルファイルのインポートはサポートされていません",
      })
    );
  }),
];
