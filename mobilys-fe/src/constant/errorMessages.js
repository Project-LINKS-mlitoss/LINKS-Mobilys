/**
 * Centralized technical error messages.
 *
 * Purpose: standardize "technical" error fallback messages (e.g. when API calls fail)
 * so they remain consistent across the app.
 *
 * Note: Japanese UI-facing error strings can live in `src/strings/errors.js`.
 */

export const ERRORS = {
    poi: {
        // Current keys used by services
        fetch: "POIデータの取得に失敗しました。",
        check: "POIインポートのチェックに失敗しました。",
        commit: "POIのコミットに失敗しました。",
        deleteBatch: "POIバッチの削除に失敗しました。",
        setActiveBatch: "POIバッチのアクティブ設定に失敗しました。",

        // Legacy keys kept for backward compatibility
        fetchFailed: "POIデータの取得に失敗しました",
        checkBatchFailed: "POIバッチファイルのチェックに失敗しました",
        commitBatchFailed: "POIバッチのコミットに失敗しました",
        deleteBatchFailed: "POIバッチの削除に失敗しました",
        setActiveBatchFailed: "POIバッチのアクティブ化に失敗しました",
    },
    visualization: {
        fetchScenariosFailed: "シナリオの取得に失敗しました",
        fetchPopulationFailed: "人口データの取得に失敗しました",
        fetchPOIsFailed: "施設データの取得に失敗しました",

        // Bus Running Visualization
        busRunningFetchFailed: "バス運行データの取得に失敗しました",
        busRunningDetailFetchFailed: "バス運行詳細データの取得に失敗しました",
        invalidModeFailed: "無効なモードが指定されました",

        // Buffer Analysis
        bufferAnalysisGraphFailed:
            "バッファ解析グラフデータの取得に失敗しました",
        bufferAnalysisGraphNoData: "バッファ解析グラフデータが見つかりません",
        bufferAnalysisMapFailed: "バッファ解析マップデータの取得に失敗しました",
        bufferAnalysisMapNoData: "バッファ解析マップデータが見つかりません",

        // Road Network Analysis
        roadNetworkFetchFailed: "道路網解析データの取得に失敗しました",
        roadNetworkGraphFailed: "道路網解析グラフデータの取得に失敗しました",
        isochroneFetchFailed: "到達圏データの取得に失敗しました",
        graphBuildFailed: "グラフの構築に失敗しました",
        graphStatusFetchFailed: "グラフ構築状況の取得に失敗しました",
        prefectureCheckFailed: "都道府県の確認に失敗しました",

        // Stop Radius Analysis
        stopRadiusMapFailed: "停留所半径解析マップデータの取得に失敗しました",
        stopRadiusMapNoData: "停留所半径解析マップデータが見つかりません",
        stopRadiusGraphFailed: "停留所半径解析グラフデータの取得に失敗しました",
        radiusAnalysisFailed: "半径解析データの取得に失敗しました",

        // OD Analysis
        odUsageDistributionFailed: "OD利用分布データの取得に失敗しました",
        odLastFirstStopFailed: "OD最初最後停留所データの取得に失敗しました",
        odBusStopFailed: "ODバス停データの取得に失敗しました",
        odUploadFailed: "ODアップロードデータの取得に失敗しました",

        // Boarding/Alighting Analysis
        boardingAlightingRoutesFailed: "乗降ルートデータの取得に失敗しました",
        boardingAlightingUploadFailed:
            "乗降アップロードデータの取得に失敗しました",
        boardingAlightingRouteGroupFailed:
            "乗降ルートグループデータの送信に失敗しました",
        boardingAlightingSegmentFailed:
            "乗降セグメントデータの送信に失敗しました",
        boardingAlightingSegmentFilterFailed:
            "乗降セグメントフィルタデータの取得に失敗しました",
        boardingAlightingSegmentGraphFailed:
            "乗降セグメントグラフデータの取得に失敗しました",
        boardingAlightingRoutesDetailFailed:
            "乗降ルート詳細データの送信に失敗しました",

        // Route and Stop Data
        routeStopFetchFailed: "ルートと停留所データの取得に失敗しました",
        routeStopNoData: "ルートと停留所データが見つかりません",

        // Validation / Preconditions
        isochroneRequired: "到達圏データ（isochrone）が必要です",
    },
    simulation: {
        carRoutingDetailFetchFailed: "自動車経路データの取得に失敗しました。",
        benefitCalculationFetchFailed: "便益計算データの取得に失敗しました。",
        co2FetchFailed: "CO₂データの取得に失敗しました。",
        operatingEconomicsFetchFailed: "運行経費の取得に失敗しました。",
        ridershipChangesFetchFailed: "利用者増減データの取得に失敗しました。",
        initDataFetchFailed: "シミュレーション初期データの取得に失敗しました。",
        detailFetchFailed: "シミュレーション詳細の取得に失敗しました。",
        unionCalendarFetchFailed: "サービスIDの取得に失敗しました。",
        runFailed: "シミュレーションの実行に失敗しました。",
        csvValidationFailed: "CSVの検証に失敗しました。",
        validationResultFetchFailed: "検証結果の取得に失敗しました。",
        validationResultDeleteFailed: "検証結果の削除に失敗しました。",
        summaryFetchFailed: "サマリーの取得に失敗しました。",
        speedChangeDefaultsFetchFailed: "旅行速度変化データの取得に失敗しました。",
        carVolumeFetchFailed: "断面交通量データの取得に失敗しました。",
        listFetchFailed: "シミュレーション一覧の取得に失敗しました。",
        createFailed: "シミュレーションシナリオの作成に失敗しました。",
        renameFailed: "名前の更新に失敗しました。",
        deleteFailed: "シミュレーションの削除に失敗しました。",
    },
    fetch: {
        scenarios: "シナリオの取得に失敗しました。",
        scenariosOwnedByUser: "シナリオの取得に失敗しました。",
        scenarioDetail: "シナリオ詳細の取得に失敗しました。",
        scenarioEditContext: "シナリオの編集コンテキスト取得に失敗しました。",
        gtfsFeedList: "GTFSフィードの取得に失敗しました。",
        gtfsFeedDetail: "GTFSフィード詳細の取得に失敗しました。",
        gtfsValidationReport: "バリデーション結果の取得に失敗しました。",
        users: "ユーザーの取得に失敗しました。",
        roles: "ロールの取得に失敗しました。",
        organizations: "組織の取得に失敗しました。",
        projects: "プロジェクトの取得に失敗しました。",
        mapList: "地図リストの取得に失敗しました。",
    },
    scenario: {
        rename: "シナリオ名の更新に失敗しました。",
        update: "シナリオの更新に失敗しました。",
        updateFeedInfo: "フィード基本情報の更新に失敗しました。",
        delete: "シナリオの削除に失敗しました。",
    },
    calendar: {
        updateCalendar: "カレンダーの保存に失敗しました。",
        updateCalendarDates: "カレンダー例外日の保存に失敗しました。",
    },
    ridership: {
        uploadFile: "乗降データのアップロードに失敗しました。",
        listUploads: "アップロード履歴の取得に失敗しました。",
        uploadDetail: "アップロード詳細の取得に失敗しました。",
        listRecords: "レコードの取得に失敗しました。",
        deleteUpload: "削除に失敗しました。",
        exportUpload: "エクスポートに失敗しました。",
        convertBoardingAlightingCsv: "変換に失敗しました。",
        convertBoardingAlightingWithMetadata: "変換に失敗しました。",
        convertOdCsv: "変換に失敗しました。",
    },
    user: {
        passwordChange: "パスワードの変更に失敗しました。",
        updateMap: "地図の変更に失敗しました。",
    },
    trip: {
        fetchFrequency: "便数の取得に失敗しました。",
        saveFrequency: "便数の保存に失敗しました。",
        fetchTrips: "便データの取得に失敗しました。",
        fetchTripDetail: "便詳細の取得に失敗しました。",
        createTrip: "便の作成に失敗しました。",
        updateTrip: "便の更新に失敗しました。",
        deleteTrips: "便の削除に失敗しました。",
        fetchFrequencyDetail: "便数詳細の取得に失敗しました。",
        fetchMapFrequency: "マップ便数の取得に失敗しました。",
    },
    route: {
        fetchGroups: "路線グループの取得に失敗しました。",
        updateGrouping: "路線グルーピングの更新に失敗しました",
        updateGroupColor: "路線グループ色の更新に失敗しました",
        createGroup: "路線グループの作成に失敗しました",
        deleteGroup: "路線グループの削除に失敗しました",
        renameGroup: "路線グループ名の更新に失敗しました",
        fetchPatterns: "路線の取得に失敗しました",
        createPattern: "路線の作成に失敗しました",
        updatePattern: "路線の更新に失敗しました",
        deletePattern: "路線の削除に失敗しました",
    },
    shape: {
        updateBulk: "シェイプの更新に失敗しました",
        preview: "シェイプのプレビューに失敗しました",
    },
    stop: {
        fetchGroups: "停留所グループの取得に失敗しました。",
        updateGrouping: "停留所グルーピングの更新に失敗しました",
        updateGroupingMethod: "グループ単位の更新に失敗しました",
        patchGroupName: "グループ名の更新に失敗しました",
        patchGroupId: "グループIDの更新に失敗しました",
        fetchStops: "停留所の取得に失敗しました",
        createStop: "停留所の作成に失敗しました",
        updateStop: "停留所の更新に失敗しました",
        deleteStop: "標柱の削除に失敗しました",
    },
    gtfs: {
        cloneScenario: "シナリオの複製に失敗しました。",
        export: "エクスポートに失敗しました。",
        validationRun: "GTFSバリデーションの実行に失敗しました。",
    },
};
