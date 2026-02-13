// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
/**
 * Simulation-related Japanese strings.
 *
 * Purpose: strings specific to simulation pages/features.
 */

export const SIMULATION = {
  carRouting: {
    filters: {
      all: "すべて",
      route: "路線",
      pattern: "運行パターン",
    },
    panels: {
      carCandidates: "自動車道",
      busRoutes: "バス路線",
    },
    legend: {
      title: "凡例",
      closeAriaLabel: "閉じる",
      start: "起点",
      end: "終点",
    },
  },
  benefitCalculation: {
    filters: {
      all: "すべて",
      route: "路線",
      pattern: "運行パターン",
    },
    table: {
      routeId: "路線ID",
      travelTimeCost: "走行時間費用（千円/年）",
      operatingCost: "走行経費（千円/年）",
      accidentLoss: "交通事故損失額（千円/年）",
      before: "Before",
      after: "After",
    },
    summary: {
      grandTotal: "計",
      diffTitle: "差分（Before − After）",
      travelTimeBenefit: "走行時間短縮便益",
      operatingCostBenefit: "走行経費減少便益",
      accidentBenefit: "交通事故減少便益",
      total: "合計",
    },
    glossary: {
      title: "用語説明",
    },
  },
  co2Reduction: {
    unit: "t-CO₂/年",
    filters: {
      all: "すべて",
      routeId: "路線ID",
      pattern: "運行パターン",
    },
    table: {
      routeId: { jp: "路線ID", en: "route_id" },
      co2ReductionHeader: (unit) => `CO₂削減（${unit}）`,
      patternIdInRoute: { jp: "路線内の運行パターンID", en: "pattern_id" },
      direction: { jp: "往復区分", en: "direction_id" },
      serviceId: { jp: "運行日ID", en: "service_id" },
      segment: { jp: "運行区間", en: "" },
      total: "計",
      unknownDash: "—",
    },
    detail: {
      vktTitle: "走行量（VKT）",
      co2Title: "CO₂削減量",
      fields: {
        routeId: { jp: "路線ID", en: "route_id" },
        patternId: { jp: "パターンID", en: "pattern_id" },
        vktBefore: { jp: "VKT（Before）", en: "vkt_before (km/day)" },
        vktAfter: { jp: "VKT（After）", en: "vkt_after (km/day)" },
        vktDelta: { jp: "VKT差分", en: "ΔVKT (km/day)" },
        ef: { jp: "排出係数", en: "EF (g-CO₂/人km)" },
        co2Annual: { jp: "CO₂削減（年）", en: "t-CO₂/year" },
      },
      units: {
        vkt: "台キロ/日",
        ef: "g-CO₂/人km",
        co2Annual: "t-CO₂/年",
      },
      formulaNote: {
        prefix: "※CO₂削減（年）",
        formula: "ΔVKT × EF × 365 / 10⁶",
        suffix: "に基づきます。",
      },
      directionMap: {
        0: "0：復路",
        1: "1：往路",
      },
    },
    glossary: {
      title: "用語説明",
      items: [
        {
          label: "VKT（Before）",
          body: "現行シナリオの1日あたりの走行距離（単位：台キロ/日）",
        },
        {
          label: "VKT（After）",
          body: "将来シナリオの1日あたりの走行距離（単位：台キロ/日）",
        },
        {
          label: "VKT差分（ΔVKT）",
          body: "シナリオ変更による走行距離の差分（単位：台キロ/日）",
        },
        {
          label: "排出係数（EF）",
          body: "1kmあたりのCO₂排出量係数（単位：g-CO₂/人km）",
        },
        {
          label: "CO₂削減（年）",
          body: "年間換算したCO₂排出量の増減（t-CO₂/year）\n算出方法：ΔVKT × EF × 365 / 10⁶",
        },
        {
          label: "t-CO₂",
          body: "二酸化炭素1トンを意味する単位",
        },
      ],
    },
  },
  csvValidation: {
    title: "CSVの検証結果",
    loading: "検証中です…",
    noResult: "検証結果がありません。",
    sections: {
      withDiff: "便数差分（差分あり）",
      noDiff: "便数差分（差分なし）",
      invalidRows: "無効行",
    },
    tables: {
      tripCountComparison: {
        patternId: "路線内の運行パターンID",
        direction: "往復区分",
        directionId: "direction_id",
        serviceId: "運行日ID",
        serviceIdKey: "service_id",
        segment: "運行区間",
        before: "現行シナリオ (Before)",
        after: "将来シナリオ (After)",
        diff: "差分",
        empty: "比較対象はありません",
        directionGeneratedTooltip:
          "システム生成の初期値です。必要に応じて変更できます。",
        directionMap: { 0: "復路", 1: "往路" },
        unknown: "-",
      },
      invalidRows: {
        routeIdPrefix: "路線ID：",
        row: "行",
        tripId: "便ID",
        issues: "問題",
        status: "ステータス",
        issueEmpty: "-",
        statusInvalid: "不正",
        statusValid: "正常",
        empty: "無効行はありません。",
      },
    },
  },
  firstInput: {
    actions: {
      runSimulation: "シミュレーション実行",
      downloadTemplate: "テンプレート（CSV）をダウンロード",
      close: "閉じる",
      removeFileAriaLabel: "remove",
      openValidationAriaLabel: "open-validation-modal",
    },
    sections: {
      scenario: "シナリオ",
      upload: "乗降データインポート",
      params: "パラメータ設定",
    },
    scenarioRows: {
      before: "現行シナリオ (Before)",
      after: "将来シナリオ (After)",
    },
    uploader: {
      requiredValue: "乗降データ",
      emptyText:
        "ファイルをここにドラッグ＆ドロップ、またはクリックして選択してください",
      acceptLabel: "対応形式：CSV",
      validationTooltip: "検証結果を表示",
    },
    serviceId: {
      title: "サービスID",
      serviceDateLabel: (count) => `運行日（CSVから選択、${count}件）`,
      serviceDateHelperWithDates: "CSVのdate列から抽出した日付のみ選択可能です。",
      serviceDateHelperNoDates: "CSVを先にインポートしてください。",
      serviceIdsLabel: (count) => `有効なサービスID（${count}件）`,
      snackbars: {
        fetched: (count) => `サービスIDを取得しました（${count}件）`,
        none: "該当するサービスIDがありません",
        failed: "サービスIDの取得に失敗しました",
      },
    },
    params: {
      ridershipSensitivity: "利用者増減感度",
      operatingEconomics: "営業損益",
      carRouting: "影響路線抽出",
      benefitCalculation: "便益算出",
      fare: "運賃",
      labels: {
        epsilonInc: "ε（増便時）",
        epsilonDec: "ε（減便時）",
        costPerShare: "1便当たりの運行コスト",
        carShare: "自動車分担率（0-1）",
        timeValue: "時間価値（円/分・台）",
        defaultFare: "運賃（円）",
      },
      fareTooltipLines: [
        "fare_rules.txt に route_id が設定されていない場合、入力した「運賃」を営業損益の計算に使用します。",
        "実際の運賃ルールを反映できないため、シミュレーション結果が実際の運用と異なる可能性があります。",
      ],
    },
    validationDialog: {
      title: "CSVの検証結果",
    },
    snackbars: {
      validationSaved:
        "検証結果を保存しました（検証結果タブで再確認できます）",
      validationDeleteFailed: "検証結果の削除に失敗しました",
      templateDownloaded: "テンプレート（CSV）をダウンロードしました",
      saved: "保存しました",
      saveFailed: "保存に失敗しました",
    },
    backdrop: {
      saving: "送信しています…",
      loading: "読み込み中…",
    },
  },
  operatingEconomics: {
    filters: {
      all: "すべて",
      routeId: "路線ID",
      pattern: "運行パターン",
    },
    detail: {
      titles: {
        conditions: "条件設定",
        results: "計算結果",
        netResult: "運行経費便益の算出結果",
      },
      fields: {
        routeId: { jp: "路線ID", en: "route_id" },
        routeLengthKm: { jp: "当該路線の延長", en: "route_length_km" },
        costPerVkm: { jp: "1便当たりの運行コスト", en: "cost per vkm" },
        fareOd: { jp: "起終点間の運賃", en: "fare (O-D)" },
        deltaVehicleKm: { jp: "運行距離の変化量", en: "Δ vehicle-km/day" },
        deltaCost: { jp: "増減便コスト変化", en: "Δ operating cost" },
        deltaRevenue: {
          jp: "利用者数増減による収入増減",
          en: "Δ revenue from riders",
        },
        netPerDay: { jp: "運行経費便益（円/日）", en: "net benefit per day" },
        annualized: {
          jp: "年間拡大",
          en: "annualized (thousand yen/year)",
        },
      },
      units: {
        km: "km",
        yenPerVkm: "円/台キロ",
        yenPerPerson: "円/人",
        vkm: "台キロ",
        yenPerDay: "円/日",
        kYenPerYear: "千円/年",
      },
    },
    table: {
      columns: {
        routeId: { jp: "路線ID", en: "route_id" },
        deltaCostPerDay: { jp: "増減便コスト変化（円/日）", en: "" },
        deltaRevenuePerDay: { jp: "収入増減（円/日）", en: "" },
        netPerDay: { jp: "運行経費便益（円/日）", en: "" },
        annualBenefit: { jp: "年間運行経費便益（千円/年）", en: "" },
        patternIdInRoute: {
          jp: "路線内の運行パターンID",
          en: "pattern_id",
        },
        direction: { jp: "往復区分", en: "direction_id" },
        serviceId: { jp: "運行日ID", en: "service_id" },
        segment: { jp: "運行区間", en: "" },
      },
      totals: {
        total: "計",
      },
      directionMap: {
        0: "0：復路",
        1: "1：往路",
      },
      unknownDash: "-",
    },
    glossary: {
      title: "用語説明",
      items: [
        {
          label: "運行距離の変化量",
          body: "シナリオ変更による1日あたりの運行距離の増減数（単位：台キロ）",
        },
        {
          label: "増減便コスト変化",
          body: "シナリオ変更による1日あたりの運行コストの増減額（単位：円/日）",
        },
        {
          label: "利用者数増減による収入増減",
          body: "利用者増減に伴う1日あたりの運賃収入の増減額（単位：円/日）",
        },
        {
          label: "運行経費便益",
          body:
            "1日あたりの純便益（単位：円/日）\n算出方法：収入増減－コスト変化",
        },
        {
          label: "年間運行経費便益",
          body: "運行経費便益を年間に変換した値（単位：千円/年）",
        },
      ],
    },
    errors: {
      missingSimulationId: "シミュレーションIDが未設定です。",
    },
  },
  speedChangeTab: {
    glossary: {
      title: "用語説明",
      items: [
        {
          label: "1台当たり走行時間（Before）",
          body: "現行シナリオの車両1台あたりの平均走行時間（単位：時間/台）",
        },
        {
          label: "1台当たり走行時間（After）",
          body: "将来シナリオの車両1台あたりの平均走行時間（単位：時間/台）",
        },
        {
          label: "総走行時間（Before）",
          body: "現行シナリオのすべての車両の走行時間を合算した値（単位：時間×台）",
        },
        {
          label: "総走行時間（After）",
          body: "将来シナリオのすべての車両の走行時間を合算した値（単位：時間×台）",
        },
      ],
    },
    messages: {
      missingSimulationId: "シミュレーションIDが未設定です。",
      noData: "データが見つかりませんでした。",
      fetchFailed: "初期値の取得に失敗しました。",
    },
  },
  speedChange: {
    filters: {
      all: "すべて",
      routeId: "路線ID",
      pattern: "運行パターン",
    },
    table: {
      outer: {
        routeId: { jp: "路線ID", en: "route_id" },
      },
      inner: {
        patternIdInRoute: { jp: "路線内の運行パターンID", en: "pattern_id" },
      },
      segments: {
        sectionCode: { jp: "区間番号", en: "" },
        roadName: { jp: "路線名", en: "" },
      },
      metrics: {
        speedKmh: "速度（km/h）",
        timePerVehicle: "1台当たり走行時間（時間/台）",
        totalTimeVehicle: "総走行時間（時間台）",
      },
      subheaders: {
        before: "Before",
        after: "After",
      },
      totals: {
        total: "計",
        average: "平均",
      },
      unknownDash: "-",
      naDash: "—",
    },
  },
  volumeCarTab: {
    filters: {
      all: "すべて",
      route: "路線",
      pattern: "運行パターン",
    },
    table: {
      routeId: { jp: "路線ID", en: "route_id" },
      patternIdInRoute: { jp: "路線内の運行パターンID", en: "" },
      carChange: { jp: "自動車の増減台数（台/日）", en: "" },
      distanceKm: { jp: "延長（km）", en: "" },
      trafficVolume: { jp: "交通量（台/日）", en: "" },
      vehKm: { jp: "走行台キロ（台キロ/日）", en: "" },
      roadName: { jp: "路線名", en: "" },
      totals: {
        total: "計",
        average: "平均",
      },
      emptySegments: "セグメントがありません",
      unknownDash: "—",
    },
    glossary: {
      title: "用語説明",
      items: [
        {
          jp: "自動車の増減台数",
          en: "",
          body: "シナリオ変更による自家用車の走行台数の増減数（単位：台/日）",
        },
        {
          jp: "延長",
          en: "",
          body: "対象区間の距離（単位：km）",
        },
        {
          jp: "交通量（Before）",
          en: "",
          body: "現行シナリオの交通量（単位：台/日）",
        },
        {
          jp: "交通量（After）",
          en: "",
          body: "将来シナリオの交通量（単位：台/日）",
        },
        {
          jp: "走行台キロ（Before）",
          en: "",
          body:
            "現行シナリオの1日に走行した車両の延べ距離（単位：台キロ/日）\n算出方法：交通量（台）× 延長（km）\n※計行には各路線で算出した値の合算を表示する",
        },
        {
          jp: "走行台キロ（After）",
          en: "",
          body:
            "将来シナリオの1日に走行した車両の延べ距離（単位：台キロ/日）\n算出方法：交通量（台）× 延長（km）\n※計行には各路線で算出した値の合算を表示する",
        },
      ],
    },
    messages: {
      missingSimulationId: "シミュレーションIDが未設定です。",
      fetchFailed: "断面交通量データの取得に失敗しました。",
    },
  },
  ridershipChange: {
    empty: "利用者増減データがありません。",
    filters: {
      all: "すべて",
      routeId: "路線ID",
      pattern: "運行パターン",
    },
    detail: {
      titles: {
        conditions: "条件設定",
        results: "計算結果",
      },
      fields: {
        routeId: { jp: "路線ID", en: "route_id" },
        baselineTrips: { jp: "運行本数（Before）", en: "B0 (trips/day)" },
        baselineRiders: { jp: "利用者数（Before）", en: "D0 (riders/day)" },
        epsilonInc: { jp: "増便感度", en: "epsilon_inc" },
        epsilonDec: { jp: "減便感度", en: "epsilon_dec" },
        afterTrips: { jp: "運行本数（After）", en: "B1 (trips/day)" },
        afterRiders: { jp: "利用者数（After）", en: "D1 (riders/day)" },
        deltaTrips: { jp: "増減便数", en: "ΔB (trips/day)" },
        deltaRiders: { jp: "増減利用者数", en: "ΔD (riders/day)" },
      },
    },
    table: {
      outer: {
        routeId: { jp: "路線ID", en: "route_id" },
        tripsPerDay: {
          jp: "運行本数（本/日）",
          beforeEn: "Before",
          afterEn: "After",
        },
        ridersPerDay: {
          jp: "利用者数（人/日）",
          beforeEn: "Before",
          afterEn: "After",
        },
        deltaRidersPerDay: { jp: "増減利用者数（人/日）", en: "" },
      },
      inner: {
        patternIdInRoute: { jp: "路線内の運行パターンID", en: "" },
        direction: { jp: "往復区分", en: "direction_id" },
        serviceId: { jp: "運行日ID", en: "service_id" },
        segment: { jp: "運行区間", en: "" },
        deltaRidersPerDay: { jp: "増減利用者数（人/日）", en: "" },
      },
      totals: {
        total: "計",
      },
      directionMap: {
        0: "0：復路",
        1: "1：往路",
      },
      unknownDash: "-",
    },
    glossary: {
      title: "用語説明",
      items: [
        {
          label: "運行本数（Before）",
          body: "現行シナリオの1日あたりの運行本数（単位：本/日）",
        },
        {
          label: "運行本数（After）",
          body: "将来シナリオの1日あたりの運行本数（単位：本/日）",
        },
        {
          label: "利用者数（Before）",
          body: "現行シナリオの1日あたりの平均利用者数（単位：人/日）",
        },
        {
          label: "利用者数（After）",
          body: "将来シナリオの1日あたりの平均利用者数（単位：人/日）",
        },
        {
          label: "増減便数",
          body: "現行シナリオと将来シナリオの運行本数の差分（単位：本/日）",
        },
        {
          label: "増減利用者数",
          body: "現行シナリオと将来シナリオの利用者数の差分（単位：人/日）",
        },
      ],
    },
  },
  detailPage: {
    title: "シミュレーション詳細",
    backToList: "シミュレーション一覧に戻る",
    unknownName: "不明",
    tabs: {
      input: "データ準備",
      validation: "検証結果",
      ridershipChange: "利用者増減",
      operatingEconomics: "営業損益",
      carRouting: "影響路線抽出",
      carVolume: "断面交通量",
      speedChange: "旅行速度変化",
      benefitCalculation: "便益算出",
      co2Reduction: "CO₂削減",
      summary: "サマリー",
    },
    messages: {
      missingSimulationId: "シミュレーションIDが未設定です。",
      detailFetchFailed: "シミュレーション詳細の取得に失敗しました。",
    },
  },
  summaryPage: {
    fileName: {
      defaultScenarioName: "シナリオ",
      pdfSuffix: "シミュレーションサマリー.pdf",
    },
    actions: {
      downloadReport: "レポートをダウンロード",
    },
    sections: {
      ridership: "公共交通利用者の増減",
      operatingEconomics: "運行経費便益",
      carVolume: "断面交通量",
      speed: "旅行速度・総走行時間",
      benefits: "便益",
      co2: "CO2削減量算出",
    },
    rows: {
      riders: "利用者数",
      trips: "運行本数",
      deltaTrips: "増減便数",
      deltaRiders: "増減利用者数",
      annualOperatingBenefit: "年間運行経費便益",
      carChange: "自動車の増減台数",
      distance: "延長",
      trafficVolume: "交通量",
      vehkm: "走行台キロ",
      speed: "速度",
      timePerVehicle: "1台当たり走行時間",
      totalVehicleTime: "総走行時間",
      benefitTravelTime: "走行時間短縮便益",
      benefitOperatingCost: "走行経費減少便益",
      benefitAccident: "交通事故減少便益",
      co2Reduction: "CO2削減量",
    },
    tooltips: {
      howLabel: "算出方法",
      ariaSuffix: "の説明",
      fallbackItem: "項目",
    },
    messages: {
      fetchFailed: "サマリーの取得に失敗しました",
    },
    tooltipsData: {
      daily_riders: {
        title: "利用者数（人/日）",
        meaning:
          "現行または将来シナリオにおいて、１日に公共交通を利用すると予測される人数です。",
        how:
          "現行シナリオでは乗降データに基づき利用者数を算出し、将来シナリオでは現行の利用者数と増減係数を用いて見込み利用者数を算出します。",
      },
      daily_trips: {
        title: "運行本数（本/日）",
        meaning:
          "現行または将来シナリオにおける、１日の総運行便数を示します。",
        how: "選択したシナリオに基づき、１日の便数を合計します。",
      },
      delta_trips_per_day: {
        title: "増減便数（本/日）",
        meaning:
          "シナリオ変更により、１日あたりの運行便数がどれだけ増減したかを示します。",
        how:
          "シナリオ変更後の便数から変更前の便数を差し引き、路線ごとの差分を集計します。",
      },
      delta_riders_per_day: {
        title: "増減利用者数（人/日）",
        meaning:
          "シナリオ変更により、１日あたりの公共交通利用者数がどれだけ増減したかを示します。",
        how: "路線ごとの利用者増減を合計します。ICデータがある場合は日種別平均を反映します。",
      },
      annual_benefit_k_yen: {
        title: "年間運行経費便益（千円/年）",
        meaning:
          "運行距離の変化、増減便コストの変化、利用者数増減による収入変化を金額換算し、年間での運行経費便益を示します。",
        how:
          "運行距離の変化量から増減便コストを算出し、利用者数増減による収入増減を加えます。収入増減から増減便コストを差し引いた日次の運行経費便益を求め、それを年間換算（×365）して千円単位で表示します。",
      },
      car_change: {
        title: "自動車の増減台数（台/日）",
        meaning: "シナリオ変更による自家用車の走行台数の増減数です。",
        how:
          "各運行パターンごとの必要台数（need_cars_per_day）の合計値を集計しています。",
      },
      distance_km: {
        title: "延長（km）",
        meaning: "対象区間の総延長距離を示します。",
        how: "対象区間の長さを合計し、kmに換算します。",
      },
      traffic_volume_sum: {
        title: "交通量（台/日）",
        meaning: "対象区間を１日に通過する車両の平均台数です。",
        how: "各区間の交通量を平均します。",
      },
      vehkm_sum: {
        title: "走行台キロ（台キロ/日）",
        meaning: "対象区間で走行した車両の延べ距離を合計した値です。",
        how: "各区間で「区間距離 × 交通量」を求め、合計します。",
      },
      speed_before_after: {
        title: "速度（km/h）",
        meaning: "分析区間の平均走行速度です。",
        how: "区間ごとの速度を平均します。",
      },
      time_per_vehicle_before_after: {
        title: "1台当たり走行時間（時間/台）",
        meaning: "１台が分析区間を走行する平均所要時間です。",
        how: "区間の所要時間を平均して算出します。",
      },
      total_vehicle_time_before_after: {
        title: "総走行時間（時間台）",
        meaning: "エリア内の全車両の延べ走行時間を示します。",
        how: "区間ごとの総走行時間を合計します。",
      },
      daily_benefits_tt: {
        title: "走行時間費用（円/日）",
        meaning: "走行時間に基づく費用を日次で算出した値です。",
        how: "走行時間に時間価値を乗じ、日次で合計します。",
      },
      daily_benefits_oc: {
        title: "走行経費（円/日）",
        meaning: "燃料費やオイル代など、走行時間以外の運行コストを日次で算出した値です。",
        how: "車両走行距離の増減に単価を乗じ、日次で合計します。",
      },
      annual_benefits_accident: {
        title: "交通事故損失額（円/日）",
        meaning: "交通事故による損失額を日次で換算した値です。",
        how: "年間の事故損失額の差分を365で割り、日次に換算します。",
      },
      annual_benefits_tt: {
        title: "走行時間短縮便益（千円/年）",
        meaning:
          "現行シナリオと将来シナリオの総走行時間の差に基づく費用便益を年間換算した値です。",
        how:
          "両シナリオの総走行時間の差に時間価値を乗じて日次の走行時間短縮便益を算出し、それを年間換算（×365）して千円単位で表示します。",
      },
      annual_benefits_oc: {
        title: "走行経費減少便益（千円/年）",
        meaning:
          "現行シナリオと将来シナリオの走行経費の差に基づく費用便益を年間換算した値です。",
        how:
          "両シナリオの走行距離の差に単価を乗じて日次の走行経費減少便益を算出し、それを年間換算（×365）して千円単位で表示します。",
      },
      annual_benefits_ac: {
        title: "交通事故減少便益（千円/年）",
        meaning:
          "現行シナリオと将来シナリオの年間交通事故損失額の差から費用便益を算出した値です。",
        how: "両シナリオの交通事故損失額の差を算出します。",
      },
      co2_reduction_tpy: {
        title: "CO₂削減量（t-CO₂/年）",
        meaning: "年間のCO₂排出削減量の推計値です。",
        how:
          "VKT変化に排出原単位を乗じ、年換算してt-CO₂に換算します。",
      },
    },
  },
  listPage: {
    title: "シミュレーションシナリオ一覧",
    createButton: "新規作成",
    empty: "シミュレーションがありません。",
    table: {
      name: "シミュレーション名",
      before: "現行シナリオ (Before)",
      after: "将来シナリオ (After)",
      createdAt: "作成日時",
      actions: "",
      source: "出典",
      project: "プロジェクト",
      unknownDash: "—",
      you: "自分",
    },
    actions: {
      detail: "詳細",
      delete: "削除",
      save: "保存",
      cancel: "キャンセル",
      create: "作成",
      creating: "作成中...",
      editName: "名前を編集",
      deleteIconLabel: "delete",
    },
    messages: {
      renameSuccess: "名前を更新しました。",
      renameFailed: "名前の更新に失敗しました。",
      deleteSuccess: "シミュレーションを削除しました。",
      deleteFailed: "シミュレーションの削除に失敗しました。",
      createSuccess: "シミュレーションシナリオを作成しました。",
      createFailed: "シミュレーションシナリオの作成に失敗しました。",
      listFetchFailed: "シミュレーション一覧の取得に失敗しました。",
      scenariosFetchFailed: "シナリオの取得に失敗しました。",
      duplicateName: "この名前のシミュレーションシナリオは既に存在します。別の名前を指定してください。",
    },
    deleteDialog: {
      title: "シミュレーションの削除確認",
      bodyTemplate: (nameOrId) => `シミュレーション「${nameOrId}」を削除しますか？`,
    },
    createDialog: {
      title: "シミュレーションシナリオの新規作成",
      baseScenario: {
        label: "現行シナリオ (Before)",
        noOptions: "利用可能なシナリオがありません",
      },
      cloneScenario: {
        label: "将来シナリオ (After)",
        noOptions: "同じ publisher_name / version の候補がありません",
      },
      name: {
        label: "シミュレーション名",
        placeholder: "例：朝ピーク時ダイヤ検証",
      },
    },
    banner: {
      maxLines: 1,
      description:
        "路線の運行本数を増減した場合の影響を、利用者数の変化、道路交通への影響、経済的便益、環境負荷など多角的に評価するシミュレーションツールです。路線再編や増減便の検討における定量的な根拠資料の作成に活用できます。",
      modalText:
        "路線の運行本数を増減した場合の影響を、利用者数の変化、道路交通への影響、経済的便益、環境負荷など多角的に評価するシミュレーションツールです。路線再編や増減便の検討における定量的な根拠資料の作成に活用できます。\n\n" +
        "シミュレーションでわかること\n" +
        "• 利用者数の変化: 増減便に伴う利用者数の増減と運賃収入への影響\n" +
        "• 道路交通への影響: 自動車交通量・走行速度・交通事故件数の変化\n" +
        "• 社会的便益: 走行時間短縮、走行経費削減、交通事故減少による便益（円/年）\n" +
        "• 運行収支: 運賃収入の増減と運行コストの増減から算出される収支への影響\n" +
        "• 環境負荷: CO₂排出削減量\n\n" +
        "これらの結果は、国土交通省の「費用便益分析マニュアル」に準拠した計算方法に基づいており、地域公共交通計画や補助金申請資料として活用できます。\n\n" +
        "（参考）\n" +
        "• 費用便益分析マニュアル（令和７年８月　国土交通省道路局　都市局）\n" +
        "• 鉄道プロジェクトの評価手法マニュアル（２０１２年改訂版（２０２５年３月一部変更）　国土交通省鉄道局）\n\n" +
        "必要なデータ\n" +
        "• 現行シナリオ（GTFSデータ）\n" +
        "• 将来シナリオ（GTFSデータ）\n" +
        "• 現行シナリオに紐づく乗降実績データ\n\n" +
        "設定項目と調整のポイント\n" +
        "１．増便感度・減便感度（デフォルト: 0.5）\n" +
        "• 運行本数を1割増やすと、利用者が何割増えるかを示す係数\n" +
        "• 都市部で頻度が高い路線 → 0.3〜0.4（本数を増やしても利用者はあまり増えない）\n" +
        "• 郊外部で頻度が低い路線 → 0.5〜0.7（本数を増やすと利用者が大きく増える）\n" +
        "• 過去に増減便した実績がある場合、実際の利用者変化から逆算して設定\n\n" +
        "２．自動車分担率（デフォルト: 0.465）\n" +
        "• 公共交通を使わなくなった人のうち、自動車に転換する人の割合\n" +
        "• 地方部（車社会） → 0.6〜0.8（ほとんどの人が車に転換）\n" +
        "• 大都市部 → 0.2〜0.4（徒歩や自転車に転換する人も多い）\n" +
        "• 地域のパーソントリップ調査があれば、そのデータを活用\n\n" +
        "３．台キロ当たり運行コスト（デフォルト: 520.9円/台km）\n" +
        "• バスを1km運行するのにかかるコスト\n" +
        "• 実際の運行事業者のコストデータがある場合はその値を使用\n" +
        "• ない場合は、デフォルト値（全国平均）を使用\n\n" +
        "注意事項\n" +
        "このシミュレーションでできること：\n" +
        "• 既存路線の運行本数を増やした場合の効果測定\n" +
        "• 既存路線の運行本数を減らした場合の影響評価\n" +
        "• 平日の定期運行路線の評価（起点→終点の一方向路線）\n\n" +
        "このシミュレーションでできないこと：\n" +
        "• 新規路線を追加、ルートや停留所を変更した場合（現在の利用者数データがないため計算不可）\n" +
        "• 路線を完全廃止した場合（運行本数ゼロは計算対象外）\n" +
        "• 休日のみ運行の路線（平日データのみ使用のため）\n" +
        "• 循環路線・往復路線（起終点が明確な路線のみ対象）",
      imageAlt: "費用便益分析マニュアルのイメージ図",
    },
  },
};
