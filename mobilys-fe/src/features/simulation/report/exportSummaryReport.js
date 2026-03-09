// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
// src/features/simulation/report/exportSummaryReport.js

let stylesInjected = false;

/* ---------- one-time print styles & root ---------- */
function ensurePrintInfra() {
    if (!stylesInjected) {
        const css = `
#print-root { display: none; }

@media print {
  /* show only the report while printing */
  body > :not(#print-root) { display: none !important; }

  /* preserve colors */
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  /* let the print root flow so it can span pages */
  #print-root { display: block; position: static; inset: auto; opacity: 1; pointer-events: auto; }

  /* page size & margins */
  @page { size: A4 portrait; margin: 12mm; }

  /* repeat table headers */
  .print-table thead { display: table-header-group; }

  .screen-only { display: none !important; }
}

/* shared report styling */
#print-root .report{
  color:#111;
  font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans JP","Hiragino Kaku Gothic ProN","Meiryo",Arial,sans-serif;
}

/* top-right header inside the report (not the browser header) */
.report .report-topbar{
  display:flex;
  justify-content:flex-end;   /* push content to the right */
  margin:0 0 6px;
}

.report .report-topbar .scenario{
  font-size:11px;
  font-weight:700;
  color:#111;
}

.report h1,.report h2,.report h3{ margin:0 0 6px; }
.report .section{
  margin:16px 0 8px;
  break-inside: avoid;
  page-break-inside: avoid;
}

.report .section > h3{
  padding-bottom:4px;
  border-bottom:1px solid #e0e0e0;
  break-after: avoid;
  page-break-after: avoid;
}


.report .box{ border:1px solid #e0e0e0; border-radius:8px; padding:12px; break-inside: avoid; }

.report table{
  width:100%;
  border-collapse:collapse;
  table-layout:fixed;           /* keeps columns aligned */
  font-size:12px;
}
.report th,.report td{ padding:6px 8px; border-bottom:1px solid #e0e0e0; vertical-align:top; }
.report thead tr{ background:#fafafa; }
.report th{ font-weight:700; }

.report td.num{
  text-align:right;
  font-variant-numeric: tabular-nums;
}

.report td.unit{
  white-space:nowrap;
  opacity:.9;
}

.report .muted{ color:#424242; font-size:11px; line-height:1.5; }
.report .explain{
  border-left:3px solid #e0e0e0;
  padding:8px 10px;
  margin-top:8px;
  break-inside: avoid;          /* explanation stays with its table */
}
.report .explain .hd{ font-weight:700; font-size:11px; margin:0 0 4px; color:#616161; }
`;
        const style = document.createElement("style");
        style.textContent = css;
        document.head.appendChild(style);
        stylesInjected = true;
    }
    let root = document.getElementById("print-root");
    if (!root) {
        root = document.createElement("div");
        root.id = "print-root";
        document.body.appendChild(root);
    }
    root.innerHTML = "";
    return root;
}

/* ---------- helpers ---------- */
const fmtInt = (n) =>
    Number.isFinite(n) ? Math.round(n).toLocaleString("ja-JP") : "—";
const fmt1 = (n) =>
    Number.isFinite(n)
        ? Number(n).toLocaleString("ja-JP", { maximumFractionDigits: 1 })
        : "—";
const fmt2 = (n) =>
    Number.isFinite(n)
        ? Number(n).toLocaleString("ja-JP", { maximumFractionDigits: 2 })
        : "—";
const fmtKmFromM = (m) => (Number.isFinite(m) ? fmt1(m / 1000) : "—");
const nowYmd = () => new Date().toISOString().slice(0, 10);
const fmtJPYk = (yenValue) => {
    if (!Number.isFinite(yenValue)) return "—";
    const yen = Math.round(yenValue);
    if (Math.abs(yen) < 1000) {
        return `${yen.toLocaleString("ja-JP")}円`;
    }
    const k = Math.round(yen / 1000);
    return `${k.toLocaleString("ja-JP")}千円`;
};

function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
        if (k === "class") node.className = v;
        else if (k === "style") node.setAttribute("style", v);
        else if (k === "html") node.innerHTML = v;
        else node.setAttribute(k, v);
    });
    (Array.isArray(children) ? children : [children]).forEach((c) => {
        if (c == null) return;
        if (typeof c === "string") node.appendChild(document.createTextNode(c));
        else node.appendChild(c);
    });
    return node;
}

/* ---------- concise explanations---------- */
const EXPLAIN_JA = {
    daily_riders_after: {
        title: "利用者数（人/日）",
        meaning: "現行または将来シナリオにおいて、１日に公共交通を利用すると予測される人数です。",
        how: "現行シナリオでは乗降集計データに基づき利用者数を算出し、将来シナリオでは現行の利用者数と増減係数を用いて見込み利用者数を算出します。",
    },
    daily_trips_after: {
        title: "運行本数（本/日）",
        meaning: "現行または将来シナリオにおける、１日の総運行便数を示します。",
        how: "選択したシナリオに基づき、１日の便数を合計します。",
    },
    delta_trips_per_day: {
        title: "増減便数（本/日）",
        meaning: "シナリオ変更により、１日あたりの運行便数がどれだけ増減したかを示します。",
        how: "シナリオ変更後の便数から変更前の便数を差し引き、路線ごとの差分を集計します。",
    },
    delta_riders_per_day: {
        title: "増減利用者数（人/日）",
        meaning: "シナリオ変更により、１日あたりの公共交通利用者数がどれだけ増減したかを示します。",
        how: "路線ごとの利用者増減を合計します。ICデータがある場合は日種別平均を反映します。",
    },
    annual_benefit_k_yen: {
        title: "年間運行経費便益（千円/年）",
        meaning:
            "運行距離の変化、増減便コストの変化、利用者数増減による収入変化を金額換算し、年間での運行経費便益を示します。",
        how: "運行距離の変化量から増減便コストを算出し、利用者数増減による収入増減を加えます。収入増減から増減便コストを差し引いた日次の運行経費便益を求め、それを年間換算（×365）して千円単位で表示します。",
    },
    car_change: {
        title: "自動車の増減台数（台/日）",
        meaning: "シナリオ変更による自家用車の走行台数の増減数です。",
        how: "各運行パターンごとの必要台数（need_cars_per_day）の合計値を集計しています。",
    },
    distance_km: {
        title: "延長（km）",
        meaning: "対象区間の総延長距離を示します。",
        how: "対象区間の長さを合計し、kmに換算します。",
    },
    vehkm_sum: {
        title: "走行台キロ（台キロ/日）",
        meaning: "対象区間で走行した車両の延べ距離を合計した値です。",
        how: "各区間で「区間距離 × 交通量」を求め、合計します。",
    },
    tv_day: {
        title: "交通量（台/日）",
        meaning: "対象区間を１日に通過する車両の平均台数です。",
        how: "各区間の交通量を平均します。",
    },
    speed: {
        title: "速度（km/h）",
        meaning: "分析区間の平均走行速度です。",
        how: "区間ごとの速度を平均します。",
    },
    tpv: {
        title: "1台当たり走行時間（時間/台）",
        meaning: "１台が分析区間を走行する平均所要時間です。",
        how: "区間の所要時間を平均して算出します。",
    },
    tvt: {
        title: "総走行時間（時間台）",
        meaning: "エリア内の全車両の延べ走行時間を示します。",
        how: "区間ごとの総走行時間を合計します。",
    },
    benefit_tt: {
        title: "走行時間短縮便益（千円/年）",
        meaning: "現行シナリオと将来シナリオの総走行時間の差に基づく費用便益を年間換算した値です。",
        how: "両シナリオの総走行時間の差に時間価値を乗じて日次の走行時間短縮便益を算出し、それを年間換算（×365）して千円単位で表示します。",
    },
    benefit_oc: {
        title: "走行経費減少便益（千円/年）",
        meaning: "現行シナリオと将来シナリオの走行経費の差に基づく費用便益を年間換算した値です。",
        how: "両シナリオの走行距離の差に単価を乗じて日次の走行経費減少便益を算出し、それを年間換算（×365）して千円単位で表示します。",
    },
    benefit_ac: {
        title: "交通事故減少便益（千円/年）",
        meaning: "現行シナリオと将来シナリオの年間交通事故損失額の差から費用便益を算出した値です。",
        how: "両シナリオの交通事故損失額の差を算出します。",
    },

    co2: {
        title: "CO₂削減量（t-CO₂/年）",
        meaning: "年間のCO₂排出削減量の推計値です。",
        how: "VKT変化に排出原単位を乗じ、年換算してt-CO₂に換算します。",
    },
};

function explanations(keys) {
    const box = el("div", { class: "explain muted" }, [
        el("div", { class: "hd" }, "説明（算出方法）"),
    ]);
    keys.forEach((k) => {
        const e = EXPLAIN_JA[k];
        if (!e) return;
        box.appendChild(
            el("div", { style: "margin:4px 0;" }, [
                el("div", { style: "font-weight:700" }, `【${e.title}】`),
                el("div", {}, e.meaning),
                el("div", { style: "opacity:.85" }, e.how),
            ])
        );
    });
    return box;
}

/* ---------- data helpers ---------- */
function computeCarTotals(data) {
    const routes = data?.car_volume_data?.data?.routes || [];
    let length_m = 0;
    let beforeVkm = 0;
    let afterVkm = 0;
    let carChange = 0; // total need_cars_per_day over all patterns

    // VolumeCarTab / SimulationSummary に合わせて、路線ごとの最大交通量の平均を算出
    let sumRouteMaxBefore = 0;
    let sumRouteMaxAfter = 0;
    let routeCount = 0;

    for (const r of routes) {
        // 1路線内での最大値を追跡する
        let routeMaxBefore = 0;
        let routeMaxAfter = 0;
        let routeHasSegments = false;

        for (const rp of r.route_patterns || []) {
            // パターンごとの必要台数（car_change）はそのまま加算
            carChange += Number(rp.need_cars_per_day) || 0;

            for (const s of rp.segments || []) {
                // 延長・走行台キロは全セグメント単純合算
                length_m += Number(s.length_m) || 0;
                beforeVkm += Number(s.before_vehicle_km_per_day) || 0;
                afterVkm += Number(s.after_vehicle_km_per_day) || 0;

                // 交通量は路線内での最大値を取る
                const bVol = Number(s.before_cars_per_day) || 0;
                const aVol = Number(s.after_cars_per_day) || 0;

                if (bVol > routeMaxBefore) routeMaxBefore = bVol;
                if (aVol > routeMaxAfter) routeMaxAfter = aVol;

                routeHasSegments = true;
            }
        }

        // セグメントが存在する路線であれば、その路線の最大値を合計に加える
        if (routeHasSegments) {
            sumRouteMaxBefore += routeMaxBefore;
            sumRouteMaxAfter += routeMaxAfter;
            routeCount++;
        }
    }

    // 路線数で割って平均を算出
    const beforeCars = routeCount > 0 ? sumRouteMaxBefore / routeCount : 0;
    const afterCars = routeCount > 0 ? sumRouteMaxAfter / routeCount : 0;

    return {
        length_m,
        beforeCars,
        afterCars,
        beforeVkm,
        afterVkm,
        carChange,
    };
}

function computeBenefitMetrics(data) {
    const r6 = data?.benefit_calculations?.data;
    if (!r6?.routes) {
        return { totals: null, annualForDisplay: null };
    }

    let tt_before = 0;
    let tt_after = 0;
    let oc_before = 0;
    let oc_after = 0;
    let ac_before = 0;
    let ac_after = 0;

    for (const route of r6.routes || []) {
        for (const shape of route.shapes || []) {
            for (const seg of shape.segments || []) {
                const m = seg.metrics || {};
                const tt = m.travel_time_savings_benefit_yen_per_year || {};
                const oc = m.operating_cost_reduction_benefit_yen_per_year || {};
                const ac =
                    m.traffic_accident_reduction_benefit_yen_per_year || {};

                tt_before += Number(tt.before ?? 0);
                tt_after += Number(tt.after ?? 0);
                oc_before += Number(oc.before ?? 0);
                oc_after += Number(oc.after ?? 0);
                ac_before += Number(ac.before ?? 0);
                ac_after += Number(ac.after ?? 0);
            }
        }
    }

    // daily differences
    const diff_tt = tt_before - tt_after; // 円/年
    const diff_oc = oc_before - oc_after; // 円/年
    const diff_ac = ac_before - ac_after; // 円/年
    const diff_total = diff_tt + diff_oc + diff_ac;

    // annual (千円/年) – same logic as SimulationSummary
    const ann_tt_k = diff_tt / 1000;
    const ann_oc_k = diff_oc / 1000;
    const ann_ac_k = diff_ac / 1000;
    const ann_total_k = ann_tt_k + ann_oc_k + ann_ac_k;

    const localK = {
        tt: ann_tt_k,
        oc: ann_oc_k,
        ac: ann_ac_k,
    };

    let annualForDisplay;

    if (r6.annual_benefits) {
        const v = r6.annual_benefits;
        const api = {
            tt: Number(v.annual_travel_time_savings_benefit),
            oc: Number(v.annual_operating_cost_reduction_benefit),
            ac: Number(v.annual_traffic_accident_reduction_benefit),
        };
        const prefer = (a, b) => (Number.isFinite(a) ? a : b);

        const tt = prefer(api.tt, localK.tt);
        const oc = prefer(api.oc, localK.oc);
        const ac = prefer(api.ac, localK.ac);

        const apiTotal = Number(r6.annual_total_benefit);
        const total = Number.isFinite(apiTotal)
            ? apiTotal
            : Math.round(tt + oc + ac);

        annualForDisplay = { tt, oc, ac, total };
    } else {
        const total = Math.round(localK.tt + localK.oc + localK.ac);
        annualForDisplay = { ...localK, total };
    }

    return {
        totals: {
            tt_before,
            tt_after,
            oc_before,
            oc_after,
            ac_before,
            ac_after,
            diff_tt,
            diff_oc,
            diff_ac,
            diff_total,
            ann_tt_k,
            ann_oc_k,
            ann_ac_k,
            ann_total_k,
        },
        annualForDisplay,
    };
}

/* ---------- tables to match “まとめ” layout ---------- */
function tableSummary(rows) {
    const t = el("table", { class: "print-table" });

    t.appendChild(
        el("colgroup", {}, [
            el("col", { style: "width:55%" }),
            el("col", { style: "width:45%" }),
        ])
    );

    t.appendChild(
        el(
            "thead",
            {},
            el("tr", {}, [el("th", {}, "指標"), el("th", {}, "値")])
        )
    );

    t.appendChild(
        el(
            "tbody",
            {},
            rows.map((r) =>
                el("tr", {}, [
                    el("td", {}, r.label),
                    el("td", { class: "num" }, [
                        document.createTextNode(r.value ?? "—"),
                        r.unit
                            ? el(
                                  "span",
                                  { class: "unit", style: "margin-left:4px" },
                                  r.unit
                              )
                            : null,
                    ]),
                ])
            )
        )
    );
    return t;
}

function tableBeforeAfter(rows) {
    const t = el("table", { class: "print-table" });

    t.appendChild(
        el("colgroup", {}, [
            el("col", { style: "width:50%" }),
            el("col", { style: "width:25%" }),
            el("col", { style: "width:25%" }),
        ])
    );

    t.appendChild(
        el(
            "thead",
            {},
            el("tr", {}, [
                el("th", {}, "指標"),
                el("th", {}, "Before"),
                el("th", {}, "After"),
            ])
        )
    );

    t.appendChild(
        el(
            "tbody",
            {},
            rows.map((r) =>
                el("tr", {}, [
                    el("td", {}, r.label),
                    el("td", { class: "num" }, [
                        document.createTextNode(r.before ?? "—"),
                        r.unit
                            ? el(
                                  "span",
                                  { class: "unit", style: "margin-left:4px" },
                                  r.unit
                              )
                            : null,
                    ]),
                    el("td", { class: "num" }, [
                        document.createTextNode(r.after ?? "—"),
                        r.unit
                            ? el(
                                  "span",
                                  { class: "unit", style: "margin-left:4px" },
                                  r.unit
                              )
                            : null,
                    ]),
                ])
            )
        )
    );
    return t;
}

/* ---------- build  the summary page ---------- */
function buildSummaryOnly(
    data,
    includeExplanations = false,
    speedTotals = null,
    scenarioName = ""
) {
    const r1 = data?.ridership_change_data?.totals || {};
    const r2 = data?.operating_economics_data?.totals || {};
    const r5Raw = data?.segment_speed_metrics_data?.totals || {};
    const r5 = speedTotals
        ? {
              speed_before_kmh: speedTotals.avg_speed_before,
              speed_after_kmh: speedTotals.avg_speed_after,
              time_per_vehicle_before_h: speedTotals.time_per_vehicle_before_h,
              time_per_vehicle_after_h: speedTotals.time_per_vehicle_after_h,
              total_time_before_vehicle_h:
                  speedTotals.total_time_before_vehicle_h,
              total_time_after_vehicle_h:
                  speedTotals.total_time_after_vehicle_h,
          }
        : r5Raw;

    const car = computeCarTotals(data);

    const { totals: benefitTotals, annualForDisplay: benefitAnnual } =
        computeBenefitMetrics(data);

    const r7 = data?.co2_reduction?.totals?.total_co2_reduction_per_year;

    const wrap = el("section", { class: "report" }, [

        el("h1", {}, "シミュレーションサマリー"),
        // el("div", { class: "muted" }, `Generated: ${nowYmd()}`),

        // ①
        el("div", { class: "section" }, [
            el("h3", {}, "① 公共交通利用者の増減"),
            (() => {
                const box = el("div", { class: "box" }, [
                    tableBeforeAfter([
                        {
                            label: "利用者数",
                            before: fmtInt(r1.total_baseline_riders_per_day),
                            after: fmtInt(r1.total_after_riders_per_day),
                            unit: "人/日",
                        },
                        {
                            label: "運行本数",
                            before: fmtInt(r1.total_baseline_trips_per_day),
                            after: fmtInt(r1.total_after_trips_per_day),
                            unit: "本/日",
                        },

                    ]),
                    tableSummary([
                        { label: "増減便数", value: fmtInt(r1.total_delta_trips_per_day), unit: "本/日" },
                        { label: "増減利用者数", value: fmtInt(r1.total_delta_riders_per_day), unit: "人/日" },
                    ]),
                ]);

                if (includeExplanations) {
                    box.appendChild(
                        explanations([
                            "daily_riders_after",
                            "daily_trips_after",
                            "delta_trips_per_day",
                            "delta_riders_per_day",
                        ])
                    );
                }
                return box;
            })(),
        ]),


        // ②
        el("div", { class: "section" }, [
            el("h3", {}, "② 運行経費便益"),
            (() => {
                const box = el(
                    "div",
                    { class: "box" },
                    tableSummary([
                        {
                            label: "年間運行経費便益",
                            value: fmtInt(r2.total_annual_benefit_k_yen),
                            unit: "千円/年",
                        },
                    ])
                );
                if (includeExplanations) box.appendChild(explanations(["annual_benefit_k_yen"]));
                return box;
            })(),
        ]),


        // ④
        el("div", { class: "section" }, [
            el("h3", {}, "③ 断面交通量"),
            (() => {
                const box = el("div", { class: "box" }, [
                    tableSummary([
                        {
                            label: "自動車の増減台数",
                            value: fmtInt(car.carChange),
                            unit: "台/日",
                        },
                        {
                            label: "延長",
                            value: fmtKmFromM(car.length_m),
                            unit: "km",
                        },

                    ]),
                    tableBeforeAfter([
                        {
                            label: "交通量",
                            before: fmtInt(car.beforeCars),
                            after: fmtInt(car.afterCars),
                            unit: "台/日",
                        },
                        {
                            label: "走行台キロ",
                            before: fmtInt(car.beforeVkm),
                            after: fmtInt(car.afterVkm),
                            unit: "台キロ/日",
                        },

                    ]),
                ]);
                if (includeExplanations)
                    box.appendChild(explanations(["car_change", "distance_km", "tv_day", "vehkm_sum"]));
                return box;
            })(),
        ]),


        // ⑤
        el("div", { class: "section" }, [
            el("h3", {}, "④ 旅行速度・総走行時間"),
            (() => {
                const box = el(
                    "div",
                    { class: "box" },
                    tableBeforeAfter([
                        {
                            label: "速度",
                            before: fmt1(r5.speed_before_kmh),
                            after: fmt1(r5.speed_after_kmh),
                            unit: "km/h",
                        },
                        {
                            label: "1台当たり走行時間",
                            before: fmt2(r5.time_per_vehicle_before_h),
                            after: fmt2(r5.time_per_vehicle_after_h),
                            unit: "時間/台",
                        },
                        {
                            label: "総走行時間",
                            before: fmt2(r5.total_time_before_vehicle_h),
                            after: fmt2(r5.total_time_after_vehicle_h),
                            unit: "時間台",
                        },

                    ])
                );
                if (includeExplanations) box.appendChild(explanations(["speed", "tpv", "tvt"]));
                return box;
            })(),
        ]),


        // ⑥
        el("div", { class: "section" }, [
            el("h3", {}, "⑤ 便益"),
            (() => {
                const box = el("div", { class: "box" }, []);

            box.appendChild(
                tableSummary([
                    {
                        label: "走行時間短縮便益",
                        value: fmtInt(benefitAnnual?.tt),
                        unit: "千円/年",
                    },
                    {
                        label: "走行経費減少便益",
                        value: fmtInt(benefitAnnual?.oc),
                        unit: "千円/年",
                    },
                    {
                        label: "交通事故減少便益",
                        value: fmtInt(benefitAnnual?.ac),
                        unit: "千円/年",
                    },
                ])
            );

            if (includeExplanations) {
                box.appendChild(explanations(["benefit_tt", "benefit_oc", "benefit_ac"]));
            }
                return box;
            })(),
        ]),
        // ⑦
        el("div", { class: "section" }, [
            el("h3", {}, "⑥ CO₂削減量"),
            (() => {
                const box = el(
                    "div",
                    { class: "box" },
                    tableSummary([
                        { label: "CO₂削減量", value: fmtInt(r7), unit: "t-CO₂/年" },
                    ])

                );
                if (includeExplanations) box.appendChild(explanations(["co2"]));
                return box;
            })(),
        ]),

    ]);

    return wrap;
}

/* ---------- main entry ---------- */
export async function exportSummaryReport(_simulationId, data, options = {}) {
    const {
        includeExplanations = false,
        filename,
        speedTotals = null,
    } = options;

    const scenarioNameFromData = 
        data?.scenario_name ||
        data?.scenario?.scenario_name ||
        data?.scenario?.name ||
        "シナリオ";

    const root = ensurePrintInfra();
    const container = el("div", { class: "report" });

    // Summary only
    container.appendChild(
        buildSummaryOnly(data, includeExplanations, speedTotals, scenarioNameFromData)
    );

    // attach to hidden print root
    root.appendChild(container);

    // ====== filename / title logic ======
    let printTitle;

    if (filename) {
        // use the filename passed from React (strip .pdf if present)
        printTitle = String(filename).replace(/\.pdf$/i, "");
    } else {
        
        const scenarioNameForTitle =
            data?.scenario_name ||
            data?.scenario?.scenario_name ||
            data?.scenario?.name ||
            "シナリオ";

        printTitle = `${scenarioNameForTitle}_シミュレーションサマリー`;
    }

    const prevTitle = document.title;
    document.title = printTitle;


    const restoreTitle = () => {
        document.title = prevTitle;
        window.removeEventListener("afterprint", restoreTitle);
    };
    window.addEventListener("afterprint", restoreTitle);
    window.print();
}
