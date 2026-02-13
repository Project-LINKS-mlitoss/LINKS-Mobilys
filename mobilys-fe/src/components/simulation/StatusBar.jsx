// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React from "react";
import { Box, useTheme } from "@mui/material";

/**
 * TreeStatusBar with orthogonal connectors.
 * Labels are placed *below each node*, centered.
 *
 * Props:
 * - labels?: string[]
 * - statuses?: Record<number, "pending"|"success"|"fail">
 */
export default function TreeStatusBar({ labels, statuses = {} }) {
  const theme = useTheme();

  const safeLabels = Array.from({ length: 7 }, (_, i) =>
    Array.isArray(labels) && typeof labels[i] === "string" ? labels[i] : ""
  );

  const nodes = [
    { id: 1, x: 80,  y: 80  },
    { id: 2, x: 250, y: 30  },
    { id: 3, x: 250, y: 130 },
    { id: 4, x: 420, y: 80  },
    { id: 5, x: 420, y: 180 },
    { id: 6, x: 590, y: 140 },
    { id: 7, x: 590, y: 220 },
  ];

  const edges = [
    [1, 2],
    [1, 3],
    [3, 4],
    [3, 5],
    [5, 6],
    [5, 7],
  ];

  const circleR = 18;

  const statusColor = (status) => {
    switch (status) {
      case "success": return theme.palette.success.main;
      case "fail":    return theme.palette.error.main;
      case "pending":
      default:        return theme.palette.grey[400];
    }
  };

  const getStatus = (id) => statuses[id] || "pending";

  return (
    <Box sx={{ width: "100%", display: "flex", justifyContent: "center" }}>
      <Box sx={{ p: 2, borderRadius: 2, bgcolor: "background.paper", boxShadow: 1, width: "100%", }}>
        <svg width="100%" height="280" viewBox="0 0 700 280">
          {/* connectors */}
          {edges.map(([a, b], i) => {
            const A = nodes[a - 1];
            const B = nodes[b - 1];
            const color = statusColor(getStatus(b));
            const x1 = A.x + circleR, y1 = A.y;
            const x4 = B.x - circleR, y4 = B.y;
            const xm = (x1 + x4) / 2;
            return (
              <path key={i}
                d={`M ${x1} ${y1} L ${xm} ${y1} L ${xm} ${y4} L ${x4} ${y4}`}
                fill="none"
                stroke={color}
                strokeWidth="2"
              />
            );
          })}

          {/* nodes + labels below */}
          {nodes.map((n) => {
            const s = getStatus(n.id);
            const color = statusColor(s);
            const label = safeLabels[n.id - 1];
            return (
              <g key={n.id} transform={`translate(${n.x},${n.y})`}>
                <circle r={circleR} fill={color} stroke={theme.palette.grey[600]} strokeWidth="1.5" />
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="13"
                  fill="#fff"
                  fontWeight="700"
                >
                  {n.id}
                </text>
                <text
                  textAnchor="middle"
                  x={0}
                  y={circleR + 16} // place text below
                  fontSize="13"
                  fill={theme.palette.text.primary}
                >
                  {label}
                </text>
              </g>
            );
          })}
        </svg>
      </Box>
    </Box>
  );
}
