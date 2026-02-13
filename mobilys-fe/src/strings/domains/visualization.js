// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
/**
 * Visualization-related Japanese strings.
 *
 * Purpose: strings specific to visualization/analysis pages.
 */

export const VISUALIZATION = {
    common: {
        scenarioFallbackName: "シナリオ",
        loading: {
            graph: "グラフを読み込んでいます...",
            results: "結果を取得中...",
        },
        weekdays: {
            short: ["日", "月", "火", "水", "木", "金", "土"],
        },
        dateParts: {
            yearSuffix: "年",
            monthSuffix: "月",
            daySuffix: "日",
            rangeSeparator: "〜",
            noData: "データなし",
        },
        units: {
            peopleSuffix: "人",
            tripSuffix: "トリップ",
            frequencySuffix: "本",
            orMoreSuffix: "以上",
        },
        time: {
            hourSuffix: "時",
            minutesSuffix: "分",
        },
        filters: {
            all: "すべて",
            allAlt: "全て",
        },
        actions: {
            expand: "拡大表示",
            downloadCsv: "CSV ダウンロード",
        },
        filenames: {
            unset: "未設定",
            mapSuffix: "地図",
            graphSuffix: "グラフ",
        },
        poiTypes: {
            school: "学校",
            hospital: "病院",
            cafe: "カフェ",
            park: "公園",
            museum: "博物館",
            shopping: "ショッピング",
            restaurant: "レストラン",
            supermarket: "スーパー",
            unknown: "不明",
        },
        labels: {
            valid: "有効",
            invalid: "無効",
            total: "合計",
            date: "日付",
            time: "時刻",
        },
        validation: {
            selectAtLeastOne: "少なくとも1つ選択してください",
        },
        table: {
            status: "ステータス",
        },
        registration: {
            unregistered: "未登録",
            registered: "登録済み",
            allRegistered: "全て登録済み",
            unregisteredOnly: "未登録データのみ",
        },
        import: {
            summaryTitle: "インポートサマリー",
        },
        emptyState: {
            noResultsRunCalculation:
                "結果がありません。計算を実行してください。",
            noMatches: "該当なし",
            noData: "データがありません。",
        },
        projectPrefecture: {
            label: "都道府県範囲",
            scenarioDefault: "シナリオ標準",
            helperNoProject: "プロジェクトを選択すると都道府県設定が有効になります。",
            helperWithProject:
                "POIの範囲に使う都道府県を指定するか、シナリオ標準のまま利用してください。",
            saving: "都道府県を保存中...",
        },
        map: {
            baseMaps: {
                pale: "淡色地図",
                std: "標準地図",
                blank: "白地図",
                photo: "写真",
            },
            attributions: {
                gsi: '© <a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a>',
            },
            labels: {
                mode: "モード",
                legendTitle: "凡例",
                legendShow: "凡例を表示",
                legendHide: "凡例を隠す",
                routeColors: "路線カラー",
                stopFallback: "停留所",
                stopSelect: "停留所選択",
                poleSelect: "標柱選択",
                selectedStopTitle: "選択中の停留所",
                poiType: "タイプ",
                setAsOrigin: "出発地点に設定する",
                remark: "備考",
                none: "なし",
                csvFile: "CSVファイル",
                lat: "緯度",
                lng: "経度",
                noPoiData: "施設データがありません",
            },
            populationLegend: {
                title: {
                    total: "人口メッシュ",
                    age0To14: "人口メッシュ（0～14歳）",
                    age15To64: "人口メッシュ（15～64歳）",
                    age65Up: "人口メッシュ（65歳以上）",
                },
            },
            actions: {
                downloadPng: "PNG をダウンロード",
                downloadMap: "地図をダウンロード",
                downloading: "ダウンロード中",
            },
            fullscreen: {
                enter: "フルスクリーン",
                exit: "フルスクリーンを終了",
            },
            errors: {
                pngExportFailedPrefix: "PNGエクスポートに失敗しました。\n",
                pngExportFailed: "PNGエクスポートに失敗しました。",
            },
        },
        dialog: {
            confirmTitle: "確認",
            cancel: "キャンセル",
            execute: "実行",
            close: "閉じる",
            open: "開く",
        },
        snackbars: {
            errorTitle: "エラーが発生しました",
            fetchScenariosFailed: "シナリオの取得に失敗しました",
            fetchPopulationFailed: "人口データの取得に失敗しました",
            fetchRoutesStopsFailed: "路線/停留所データの取得に失敗しました",
            fetchGraphDataFailed: "グラフデータの取得に失敗しました",
            fetchMapFeaturesFailed: "地図のフィーチャーの取得に失敗しました",
            checkPrefAvailabilityFailed:
                "都道府県の利用可能性の確認に失敗しました",
            fetchGraphBuildStatusFailed:
                "グラフビルドステータスの取得に失敗しました",
            startGraphBuildFailed: "グラフビルドの開始に失敗しました",
            fetchServicesFailed: "サービスの取得に失敗しました",
            generateBufferFailed: "バッファの生成に失敗しました",
            networkGraphReady: "ネットワークグラフの準備ができました",
            networkGraphBuildFailed: "ネットワークグラフのビルドに失敗しました",
        },
        messages: {
            loadingGraphData: "グラフを読み込み中です...",
        },
    },
    pageBanner: {
        moreLabel: "全文を表示",
        closeLabel: "閉じる",
        modalTitle: "説明",
    },
    titles: {
        bufferAnalysis: "到達圏分析（バッファ）",
        roadNetworkAnalysisOsm:
            "到達圏分析（OpenStreetMapを利用した道路ネットワーク解析）",
        roadNetworkAnalysisDrm:
            "到達圏分析（DigitalRoadMapを利用した道路ネットワーク解析）",
        busRunningVisualization: "運行頻度分析",
        busRunningTripCountAnalysis: "運行本数分析",
        stopRadiusAnalysis: "公共交通圏域",
        radiusAnalysis: "スポット分析",
        odAnalysis: "ODデータ分析",
        boardingAlightingAnalysis: "乗降データのダッシュボード",
        routeTimetable: "経路・時刻表",
    },
    bufferAnalysis: {
        description: `
  指定した地点から徒歩と公共交通を組み合わせて一定時間内に到達できる範囲を可視化し、公共交通のカバー状況や施設へのアクセス性を評価します。​

  分析でわかること
  ・時間距離圏の可視化：10分、20分、30分など所要時間別に到達できる範囲を等時間圏として地図上に表示
  ・アクセス可能な施設：病院、学校、商業施設など、時間内に到達できる主要施設を把握
  ・カバー人口の把握：到達圏域内の人口を年齢層別に集計し、サービス対象人口を定量的に評価

  活用のポイント
  ・公共交通空白地の特定：主要な拠点から一定時間内に到達できない地域（公共交通空白地）を明確化し、
    新規路線やデマンド交通の導入を検討
  ・施設立地との整合性確認：病院、役所、商業施設など生活に必要な施設が、
    住民にとって利用可能な時間距離にあるかを評価
  ・まちづくり計画との連携：立地適正化計画における都市機能誘導区域や居住誘導区域と
    公共交通の到達圏を重ね合わせ、コンパクト・プラス・ネットワークの実現度を確認
  ・サービス改善の優先順位づけ：カバー人口が多いにもかかわらず十分なサービスが提供されていない地域や、
    高齢者人口が集中する地域への対応を優先的に検討

  評価の目安
  公共交通の徒歩圏は一般的にバス停から半径300m（徒歩約5分）、鉄道駅から半径500m（徒歩約7分）が標準とされています。
  日常的な移動範囲として、徒歩と公共交通を組み合わせて30分以内に主要な生活施設にアクセスできることが、
  利便性の高い公共交通ネットワークの一つの目安となります。
  `,
        components: {
            filterPanel: {
                title: "条件設定",
                origin: {
                    title: "出発地点",
                    latitude: "緯度",
                    longitude: "経度",
                },
                date: "日付",
                departureTime: "出発時刻",
                walkingSpeed: "歩くスピード (km/hr)",
                actions: {
                    reset: "リセット",
                    calculate: "計算",
                },
            },
            map: {
                time: {
                    travelTime: "所要時間",
                    withinMinutesSuffix: "分以内",
                    minutesSuffix: "分",
                },
                opacity: {
                    label: "透明度",
                    percentSuffix: "%",
                },
                layers: {
                    pois: "施設",
                    buffer: "到達圏",
                },
                ageGroups: {
                    all: "すべて",
                    age0To14: "0-14歳",
                    age15To64: "15-64歳",
                    age65Up: "65歳以上",
                },
                originLabel: "出発地点",
            },
            graphs: {
                poi: {
                    title: "アクセス可能な施設",
                    emptyState: "データがありません。",
                    actions: {
                        expand: "拡大表示",
                    },
                    export: {
                        graphName: "アクセス可能な施設",
                        headers: {
                            time: "時間",
                            poiType: "施設タイプ",
                            poiName: "施設名称",
                            address: "住所",
                        },
                    },
                },
                routeAndStop: {
                    title: "路線・停留所一覧",
                    export: {
                        pngFilename: "所要時間別路線・停留所一覧.png",
                        excelFilename: "路線・停留所一覧.xlsx",
                        sheetName: "ルート分析",
                        headers: {
                            time: "時間",
                            groupName: "グループ名",
                            routeId: "路線ID",
                            stopInfo: "ストップ情報",
                        },
                    },
                    chart: {
                        routeCount: "ルート数",
                        stopCount: "停留所数",
                    },
                    actions: {
                        expand: "拡大表示",
                    },
                },
                stops: {
                    title: "アクセス可能な停留所",
                    export: {
                        graphName: "アクセス可能な停留所",
                        headers: {
                            time: "時間",
                            parentStop: "親停留所",
                            stopName: "標柱名称",
                            stopId: "標柱ID",
                        },
                    },
                    table: {
                        parentStopName: "停留所名称",
                        parentStopId: "停留所ID",
                    },
                    emptyState: "データがありません。",
                    actions: {
                        expand: "拡大表示",
                    },
                },
                population: {
                    title: "所要時間別到達圏域内の人口",
                    emptyState: "データがありません。",
                    export: {
                        graphName: "所要時間別到達圏域内の人口",
                        headers: {
                            time: "時間",
                            total: "総数",
                            age0To14: "0-14歳",
                            age15To64: "15-64歳",
                            age65Up: "65歳以上",
                        },
                    },
                    tooltip: {
                        total: "合計",
                        peopleSuffix: "人",
                    },
                    actions: {
                        expand: "拡大表示",
                        downloadPngGraphOnly: "ダウンロード PNG (グラフのみ)",
                        exportExcel: "エクスポート Excel",
                    },
                },
            },
        },
    },
    busRunningVisualization: {
        title: "運行本数分析",
        components: {
            filterPanel: {
                title: "条件設定",
                routeLabel: "路線グループ",
                direction: "往復区分",
                allDirections: "すべて",
                stopType: "標柱/停留所",
                stopTypeOptions: {
                    child: "標柱",
                    parent: "停留所",
                },
                defaultRouteGroupLabel: "すべて",
                travelDayLabel: "運行日",
                travelDayHelper: "少なくとも1つ選択してください",
                buttons: {
                    reset: "リセット",
                    calculate: "計算",
                },
                serviceLabel: "Service ID",
                errors: {
                    routeGroupsRequired:
                        "Please select at least one route group before applying the filter.",
                    serviceRequired:
                        "Please select at least one service before applying the filter.",
                },
            },
            graphPanel: {
                title: "時間帯別運行本数",
                missingData: "表示するデータがありません",
                hiddenCount: "他{count}件を表示",
                partialView: "一部だけ表示",
                legend: {
                    trips: "運行本数",
                    routes: "路線",
                },
                axis: {
                    time: "時間帯",
                    frequency: "運行本数",
                },
                download: {
                    csv: "CSV をダウンロード",
                    png: "PNG をダウンロード",
                },
            },
            mapLayerControl: {
                title: "レイヤー",
                baseMaps: {
                    pale: "淡色地図",
                    std: "標準地図",
                    blank: "白地図",
                    photo: "写真",
                },
                layers: {
                    edges: "路線単色",
                    routeColors: "路線カラー",
                    routeLabels: "路線ラベル",
                    stops: "標柱/停留所",
                    stopLabels: "停留所ラベル",
                    serviceFrequency: "運行頻度",
                },
                sectionLabels: {
                    layers: "レイヤー",
                    map: "地図",
                    population: "人口メッシュ",
                },
                populationFilters: {
                    all: "すべて",
                    age0To14: "0-14歳",
                    age15To64: "15-64歳",
                    age65Up: "65歳以上",
                },
            },
            graphExports: {
                routeGroup: {
                    title: "路線別運行本数",
                    chartTitle: "路線別運行本数（グラフ）",
                    downloadCsv: "CSV ダウンロード",
                    downloadPng: "PNG ダウンロード",
                },
                stop: {
                    title: "停留所別運行本数",
                    downloadCsv: "CSV ダウンロード",
                },
            },
        },
        description: `
    選択した路線や停留所の運行本数を可視化し、地域公共交通のサービス水準を評価できます。
    路線別・時間帯別の運行状況を把握することで、地域の実情に応じた運行計画の検討にご活用ください。

    サービス水準の評価基準 
    運行本数は公共交通のサービス水準を測る重要な指標です。一般的な目安として以下を参考にしてください​。

    ・高頻度運行（都市部幹線）: 1時間あたり2～4便（15～30分間隔）以上
    通勤・通学時間帯を中心に高い利便性を提供し、「時刻表なし」で利用できるレベル

    ・標準的運行（一般路線）：1日30～100本程度
    生活に必要な移動需要に対応できるサービス水準

    ・最低限の運行（支線・郊外路線）：1日10～30本程度
    通勤・通学時間帯を中心にサービスを提供

    分析のポイント
    ・時間帯別の運行状況：
    朝夕のピーク時間帯（7～9時、17～19時）に十分な便数があるか、
    日中時間帯の運行間隔は住民ニーズに対応しているか

    ・路線別の役割：
    複数路線が重複する区間では合計本数で実質的なサービス水準を把握し、
    幹線と支線の役割分担を明確化

    ・利用実態との照合：
    主要な病院の診療開始時間、学校の始業時間、商業施設の営業時間に間に合う便があるか、
    実際の「おでかけ」のしやすさを評価
    `,
    },
    roadNetworkAnalysisOsm: {
        screenName: "到達圏分析（OSM）",
        description: `
  OpenStreetMapの実際の道路ネットワークデータを用いて、指定した地点から徒歩と公共交通を組み合わせて一定時間内に到達できる範囲を、実際の道路形状に基づいて精密に可視化します。より現実的なアクセス性評価が可能となります。​

  バッファ分析との違い
  ・バッファ分析：直線距離や単純な時間距離に基づく概略的な到達圏を表示（円形に近い形状）
  ・ネットワーク解析：実際の道路、歩道、交差点の配置を考慮した到達圏を表示（道路形状に沿った形状）
  ネットワーク解析では、実際の道路の接続状況を反映するため、より正確なアクセス可能範囲を把握できます。

  分析でわかること
  ・時間距離圏の可視化：10分、20分、30分など所要時間別に到達できる範囲を等時間圏として地図上に表示
  ・アクセス可能な施設：病院、学校、商業施設など、時間内に到達できる主要施設を把握
  ・カバー人口の把握：到達圏域内の人口を年齢層別に集計し、サービス対象人口を定量的に評価

  活用のポイント
  ・公共交通空白地の特定：地図上では近くに見えても、実際には道路がなくアクセスできない地域を明確化
  ・バス停・駅の配置計画：最大歩行距離を変更しながら分析することで、新規停留所の最適な配置場所を検討

  設定のポイント
  ・最大歩行距離：バス停までの徒歩圏を300m〜800mで設定（一般的には300m、郊外部では500〜800mも検討）
  ・歩くスピード：一般的な歩行速度4.8km/h（80m/分）。高齢者が多い地域では3.6km/h程度に調整
  ・ネットワークの更新：新規道路の開通や公共交通路線の変更があった場合、「解析用ネットワークを再構築」で最新化
  `,
        confirmText: {
            whenBuilt:
                "既に解析用ネットワークが構築されています。この処理には数分かかる場合があります。再構築が完了すると、お知らせが届きます。実行しますか？",
            otherwise:
                "この処理には数分かかる場合があります。構築が完了すると、お知らせが届きます。実行しますか？",
        },
        components: {
            filterPanel: {
                title: "条件設定",
                actions: {
                    build: "解析用ネットワークを新規構築",
                    rebuild: "解析用ネットワークを再構築",
                    reset: "リセット",
                    calculate: "計算",
                    refreshStatus: "状態を再取得",
                },
                labels: {
                    origin: "出発地点",
                    lat: "緯度",
                    lng: "経度",
                    date: "日付",
                    departureTime: "出発時刻",
                    maxWalkingDistanceM: "最大歩行距離 (m)",
                    walkingSpeedKmh: "歩くスピード (km/hr)",
                },
                messages: {
                    checkingBaseData: "ベースデータの有無を確認中…",
                    prefectureMissingPrefix: "",
                    prefectureMissingSuffix:
                        "の道路のデータがないためこちらのシナリオは使用できません。",
                    building: "データ構築中です。少々お待ちください。",
                    statusStale:
                        "進行状況の更新が停止しているようです。状態を再取得してください。",
                },
            },
            graphs: {
                poi: {
                    title: "アクセス可能な施設",
                    exportExcelTitle: "Export 施設一覧 (Excel)",
                    csvHeaders: {
                        time: "時間",
                        poiType: "施設タイプ",
                        poiName: "施設名称",
                        address: "住所",
                    },
                },
                stops: {
                    title: "アクセス可能な停留所",
                    csvHeaders: {
                        time: "時間",
                        stopName: "停留所名称",
                        stopId: "停留所ID",
                        poleName: "標柱名称",
                        poleId: "標柱ID",
                    },
                },
                routesAndStops: {
                    title: "路線・停留所一覧",
                    csvHeaders: {
                        time: "時間",
                        groupName: "グループ名",
                        routeId: "路線ID",
                        stopInfo: "ストップ情報",
                        stopCount: "停留所数",
                    },
                    filenames: {
                        png: "路線・停留所一覧.png",
                        xlsx: "路線・停留所一覧.xlsx",
                    },
                },
            },
        },
    },
    roadNetworkAnalysisDrm: {
        screenName: "到達圏分析（DRM）",
        description: `
  DRMデータベース（デジタル道路地図）を活用し、指定した地点から徒歩と公共交通を組み合わせて一定時間内に到達できる範囲を、高精度な道路ネットワークに基づいて可視化します。

  一般財団法人日本デジタル道路地図協会が提供するDRMデータベース（デジタル道路地図）を利用しています。ネットワーク解析では、実際の道路の接続状況を反映するため、より正確なアクセス可能範囲を把握できます。

  DRMデータの特徴
  ・高精度・高信頼性：道路管理者による公式データを基にした正確な道路情報
  ・詳細な属性情報：道路種別、車線数、幅員などの詳細な道路属性
  ・安定した更新：公式な道路台帳に基づく確実なデータ更新

  到達圏分析（OSM）との違い
  DRMは車道中心のため、実際には歩いて通れる近道があっても検出されない場合があります。一方、OSMは地域により整備状況にばらつきがあるため、郊外部では道路データが不足している可能性があります。両方の結果を比較検討することをお勧めします。

  到達圏分析（バッファ）との違い
  ・バッファ分析：直線距離や単純な時間距離に基づく概略的な到達圏を表示（円形に近い形状）
  ・ネットワーク解析：実際の道路、歩道、交差点の配置を考慮した到達圏を表示（道路形状に沿った形状）

  分析でわかること
  ・時間距離圏の可視化：10分、20分、30分など所要時間別に到達できる範囲を等時間圏として地図上に表示
  ・アクセス可能な施設：病院、学校、商業施設など、時間内に到達できる主要施設を把握
  ・カバー人口の把握：到達圏域内の人口を年齢層別に集計し、サービス対象人口を定量的に評価

  活用のポイント
  ・公共交通空白地の特定：地図上では近くに見えても、実際には道路がなくアクセスできない地域を明確化
  ・バス停・駅の配置計画：最大歩行距離を変更しながら分析することで、新規停留所の最適な配置場所を検討

  設定のポイント
  ・最大歩行距離：バス停までの徒歩圏を300m〜800mで設定（一般的には300m、郊外部では500〜800mも検討）
  ・歩くスピード：一般的な歩行速度4.8km/h（80m/分）。高齢者が多い地域では3.6km/h程度に調整
  ・ネットワークの更新：新規道路の開通や公共交通路線の変更があった場合、「解析用ネットワークを再構築」で最新化
  `,
        confirmText: {
            whenBuilt:
                "既に解析用ネットワークが構築されています。\\nこの処理には数分かかる場合があります。\\n再構築が完了すると、お知らせが届きます。\\n\\n実行しますか？",
            otherwise:
                "この処理には数分かかる場合があります。\\n構築が完了すると、お知らせが届きます。\\n\\n実行しますか？",
        },
    },
    stopRadiusAnalysis: {
        errors: {
            fetchScenarioFailed: "シナリオの取得に失敗しました",
            fetchRoutesAndStopsFailed:
                "ルートと停留所のデータの取得に失敗しました",
            fetchPopulationFailed: "人口データの取得に失敗しました",
            baseDataNotLoaded: "ベースデータ未取得",
            mockDataGenerationFailed: "モックデータ生成に失敗しました",
        },
        description: `
  選択した公共交通路線のすべての停留所から指定した距離（徒歩圏）内の範囲を「公共交通圏域」として可視化し、その圏域内にある施設や人口を集計します。地域全体での公共交通のカバー状況を一目で把握できます。

  分析でわかること
  • 公共交通圏域の可視化: すべての停留所から徒歩圏を円形で表示し、重
  なり合った範囲を公共交通でアクセス可能な圏域として把握
  • 圏域内の施設集計: 病院、学校、商業施設など、圏域内に立地する主要
  施設の数と分布
  • 圏域内人口: 年齢層別の人口を集計し、公共交通でカバーできている住
  民数を把握

  活用のポイント
  • 公共交通空白地の特定: 圏域外となっている地域を把握し、新規路線や
  停留所の配置を検討
  • サービス水準の評価: 徒歩圏の距離設定を変えながら分析することで、
  地域の実情に応じた適切なサービス水準を検討。
  • 施設立地との整合性: 病院や学校など重要施設が公共交通圏域内にある
  かを確認し、住民の生活利便性を評価
  • 路線再編の検討: 圏域が重複している区間では統廃合の可能性を、圏域
  の空白地では新規路線の必要性を検討

  設定のポイント
  徒歩圏の距離設定は、地域の特性に応じて以下を目安に設定してください。
  • 都市部：300m（徒歩約4分）
  • 一般地域：500m（徒歩約7分）
  • 郊外部：800m（徒歩約10分）
  `,
        labels: {
            scenario: "シナリオ",
            radiusMeters: "半径 (メートル)",
            stop: "停留所",
            routeGroup: "路線グループ",
            routeName: "路線名",
            poiType: "施設タイプ",
            poiName: "施設名称",
            poiAddress: "施設住所",
            age0_14: "0-14歳",
            age15_64: "15-64歳",
            age65Up: "65歳以上",
            populationTotal: "総数",
        },
        actions: {
            reset: "リセット",
            calculate: "計算",
        },
        components: {
            filterPanel: {
                title: "条件設定",
            },
            graphContainer: {
                emptyState: "結果がありません。計算を実行してください。",
            },
            poiGraph: {
                title: "施設タイプ別分布",
                csvHeaders: {
                    radiusMeters: "半径(メートル)",
                    poiType: "施設タイプ",
                    poiName: "施設名",
                    poiAddress: "施設住所",
                },
                unknownType: "未分類",
                countLabel: "件数",
            },
            populationGraph: {
                title: "年齢別人口数",
                stopSearchLabel: "停留所を検索",
                stopSearchPlaceholder: "選択...",
                csvHeaders: {
                    ageGroup: "年齢層",
                    people: "人数",
                },
            },
            routeGraph: {
                title: "停留所別路線数",
                stopSearchLabel: "停留所を検索",
                stopSearchPlaceholder: "選択...",
                emptyRouteGroup: "路線グループなし",
                emptyRoute: "路線なし",
            },
            map: {
                stopSelect: "停留所選択",
                layers: {
                    radius: "半径",
                    pois: "施設",
                },
            },
        },
    },
    routeTimetable: {
        errors: {
            fetchScenarioFailed: "シナリオの取得に失敗しました",
            fetchTimetableFailed: "時刻表の取得に失敗しました",
        },
        labels: {
            stopTimetable: "停留所時刻表",
            stop: "停留所",
            pole: "標柱",
            timetableSuffix: "時刻表",
        },
        actions: {
            download: "ダウンロード",
            expand: "拡大表示",
        },
        messages: {
            loadingTimetable: "時刻表を読み込み中です...",
            clickStopToShow: "停留所をクリックすると時刻表を表示します。",
            clickStopToShowOnMap:
                "時刻表を表示するには、地図上で停留所をクリックしてください。",
            noData: "データがありません。",
        },
        components: {
            filterPanel: {
                title: "条件設定",
                scenarioPlaceholder: "シナリオを選択",
                stopChild: "標柱",
                stopParent: "停留所",
                direction: "往復",
            },
            timetableMap: {
                upstreamTemplate:
                    "https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png",
                proxiedGrayTilePane: "tilePane",
                defaultColor: "#58AB39",
                routeLabelsPane: "route-timetable-route-labels",
                routeTooltipPane: "route-timetable-route-tooltips",
                stopLabelsPane: "route-timetable-stop-labels",
                routeTimetableHighlightPane: "route-timetable-highlight",
                screenName: "経路・時刻表",
                defaultSelectedTile: "pale",
            },
        },
    },
    boardingAlightingAnalysis: {
        routeLevelTitle: "路線の乗降分析",
        backToPage: "乗降分析画面に戻る",
        canDoDescription:
            "乗降調査等の乗降実績データを活用し、路線・停留所・時間帯別の利用状況を多角的に可視化・分析するツールです。実際の利用実態に基づいた路線計画の検討やサービス改善に活用できます。​",
        labels: {
            route: "路線",
        },
        tables: {
            routesNotInGtfs: "GTFSデータに存在しない路線",
            validRoutes: "有効な路線",
            tripsNotInGtfs: "GTFSデータに存在しない便",
            stopsNotInGtfs: "GTFSデータに存在しない停留所",
            validTrips: "有効な便",
            validStops: "有効な停留所",
        },
        visualizationOptions: {
            segmentUsersByTime: "区間の時間帯別利用者数",
            stopUsers: "停留所別利用者数",
        },
        upload: {
            resultTitle: "乗降データインポート結果",
            invalidCsvHeaders:
                "CSVのヘッダーが不正です。次のヘッダーが必要です: date, agency_id, route_id, trip_id, stop_id, stop_sequence, count_geton, count_getoff",
            summary: {
                trip: "便",
                stop: "停留所",
            },
        },
        exports: {
            screenName: "乗降分析",
            routeGraphBase: "路線の乗降分析",
            routeGraph: {
                byRoute: "路線の乗降分析_路線別乗降実績",
                byTripInVehicle: "路線の乗降分析_便別通過人員",
                byTripBoardingAlighting: "路線の乗降分析_便別乗降人数",
            },
            mapSuffix: "地図",
            maps: {
                routeMap: {
                    title: "路線の乗降分析",
                },
                routeSegment: {
                    screenName: "乗降分析_区間別通過人員_地図",
                },
                routeStop: {
                    total: "停留所別利用者数（合計）",
                    boarding: "停留所別利用者数（乗車人数）",
                    alighting: "停留所別利用者数（降車人数）",
                },
            },
            stopGraph: {
                total: "停留所別利用者数（合計）",
                boarding: "停留所別利用者数（乗車人数）",
                alighting: "停留所別利用者数（降車人数）",
                graphNameSuffix: "停留所別利用者数",
            },
        },
        components: {
            dashboard: {
                emptyState: {
                    title: "まだ乗降データがありません",
                    description:
                        "左側の「乗降データ管理」からCSVをインポートすると、日別ダッシュボードを表示できます。",
                },
                labels: {
                    passengers: "乗降数",
                    targetPeriod: "対象期間",
                    startYear: "開始年",
                    startMonth: "開始月",
                    endYear: "終了年",
                    endMonth: "終了月",
                    resetPeriod: "期間をリセット",
                    clearSelection: "選択解除",
                },
                cards: {
                    totalPassengers: "総乗降数",
                    dailyAverage: "1日平均",
                    weekdayAverage: "平日平均",
                    weekendAverage: "休日平均",
                },
                sections: {
                    monthlyCalendar: "月間カレンダー",
                    dailyTrend: "日別乗降数推移",
                    weekdayAverages: "曜日別平均乗降数",
                },
                series: {
                    weekday: "平日",
                    weekend: "休日",
                    average: "平均",
                },
            },
            routesVisualization: {
                form: {
                    timeRange: "タイムレンジ",
                    date: "日付",
                    routeGroup: "路線グループ",
                    route: "路線",
                    tripId: "便ID",
                },
                actions: {
                    reset: "リセット",
                    calculate: "計算",
                },
                emptyState:
                    "データがありません。フィルター条件を変えてください。",
            },
            routesVisualizationChart: {
                emptyState:
                    "データがありません。フィルター条件を変えてください。",
                axis: {
                    people: "人数",
                },
                series: {
                    boardings: "乗車数",
                    alightings: "降車数",
                    inVehicle: "通過人員",
                },
                tooltip: {
                    boardings: "乗車数",
                    alightings: "降車数",
                    inVehicle: "通過人員",
                },
                legend: {
                    toggleSuffix: " を表示/切替",
                },
                actions: {
                    showTop10: "TOP10まで表示",
                    showAllTrips: "すべての便を表示",
                },
                sections: {
                    graphTitle: "乗降グラフ",
                    byRoute: "路線別乗降実績",
                    byTripInVehicle: "便別通過人員",
                    byTripBoardingAlighting: "便別乗降人数",
                    stats: "利用者数の統計",
                },
                labels: {
                    routeId: "路線ID",
                    routeName: "路線名",
                },
                table: {
                    metric: "指標",
                    average: "平均",
                    max: "最大",
                    total: "合計",
                },
            },
            routeStopVisualization: {
                title: "停留所別利用者数",
                stopNameLabel: "停留所名",
                axis: {
                    people: "人数",
                },
                series: {
                    boarding: "乗車人数",
                    alighting: "降車人数",
                    boardingPlusAlighting: "乗車人数＋降車人数",
                },
                tooltip: {
                    boarding: "乗車人数",
                    alighting: "降車人数",
                },
                table: {
                    metric: "指標",
                    average: "平均",
                    max: "最大",
                    total: "合計",
                },
                form: {
                    timeRange: "タイムレンジ",
                    date: "日付",
                    routeGroup: "路線グループ",
                    route: "ルート",
                    tripId: "便ID",
                },
            },
            dataManagement: {
                title: "乗降データ管理",
                gtfsWarning:
                    "このシナリオはGTFS編集で作成されたものです。利用実績・乗降が路線や便や停留所などに正しく表示されないことがあります。",
                requiredScenario: "シナリオ",
                uploader: {
                    emptyText:
                        "ファイルをここにドラッグ＆ドロップ、またはクリックして選択してください",
                    acceptLabel: "対応形式：CSV",
                },
                actions: {
                    downloadTemplate: "テンプレートをダウンロード",
                    import: "インポート",
                    delete: "削除",
                    dashboard: "ダッシュボード",
                },
                labels: {
                    importedData: "インポート済み乗降データ",
                    filename: "ファイル名",
                    importedAt: "インポート日時",
                    analysisReport: "乗降データの分析レポート",
                },
                statuses: {
                    readingCsv: "CSVを読み込んでいます...",
                },
                errors: {
                    scenarioNotSelected: "シナリオが未選択です。",
                    importFailed: "CSVのインポートに失敗しました",
                    requiredColumnsPrefix: "必要な列:",
                    importFailedWithDetailPrefix:
                        "CSVのインポートに失敗しました：",
                },
                filenames: {
                    templateBase: "jyoukou_template",
                    defaultDisplayFilename: "乗降データ",
                },
                csvTemplate: `date,agency_id,route_id,trip_id,stop_id,stop_sequence,count_geton,count_getoff
20251001,5230001002133,４１号線（笹津・猪谷）線(112_1_1),平日_06時05分_系統112_1_1,101_05,1,5,0
20251001,5230001002133,４１号線（笹津・猪谷）線(112_1_1),平日_06時05分_系統112_1_1,310_01,12,5,0
20251001,5230001002133,４１号線（笹津・猪谷）線(112_1_1),平日_06時05分_系統112_1_1,314_01,16,0,1
`,
            },
            clickDetailDialog: {
                titleSuffix: "の詳細",
                empty: "該当なし",
                sections: {
                    segmentBreakdown: "路線別通過人員内訳",
                    overview: "概要",
                    routeBreakdown: "路線別通過人員内訳",
                },
                labels: {
                    routeCount: "路線数",
                    tripCount: "便数",
                    totalBoardings: "合計（乗車数）",
                    totalAlightings: "合計（降車数）",
                    tripId: "便ID",
                    boardings: "乗車数",
                    alightings: "降車数",
                    firstDeparture: "初発",
                },
                table: {
                    tripCount: "便数",
                    average: "平均",
                    total: "合計",
                },
            },
            routeSegmentVisualization: {
                title: "時間帯別利用者数",
                series: {
                    inVehicle: "通過人員",
                    boarding: "乗車人数",
                    alighting: "降車人数",
                },
            },
        },
    },
    odAnalysis: {
        description:
            "ICカードの履歴データ等から集計したＯＤデータを活用し、利用者が「どこから乗車して、どこで降車したか」の移動パターンを可視化する機能です。",
        visualizationOptions: {
            stopUsage: "停留所利用状況",
            usageDistribution: "OD利用分布",
            boardingAlightingPoints: "OD乗降ポイント",
        },
        components: {
            common: {
                labels: {
                    stopName: "停留所名",
                    boarding: "乗車",
                    alighting: "降車",
                    boardingCount: "乗車人数",
                    alightingCount: "降車人数",
                    totalUsersOriginDest: "利用者数(起点・終点)",
                    firstStop: "起点",
                    lastStop: "終点",
                },
                actions: {
                    expand: "拡大表示",
                    downloadCsv: "CSV ダウンロード",
                },
                instructions: {
                    selectStopOnMap: "地図上で停留所を選択してください",
                },
            },
            busStop: {
                title: "バス停間OD一覧",
                filenameTitle: "OD量の可視化_バス停間OD一覧",
                labels: {
                    topCountByVolume: "表示件数（輸送量が多い順）",
                    volume: "輸送量",
                },
                table: {
                    headers: {
                        getonStop: "乗車停留所",
                        getoffStop: "降車停留所",
                        volume: "輸送量",
                    },
                },
            },
            usageDistribution: {
                titleBase: "停留所別利用者数",
                titles: {
                    origin: "停留所別乗車人数（乗車）",
                    dest: "停留所別利用者数（降車）",
                    sum: "停留所別利用者数（合計）",
                },
            },
            lastFirstStop: {
                listTitleSuffix: "一覧",
                fileTitlePrefix: "OD流動図",
                fileTitleBody: "起点・終点一覧",
            },
            management: {
                title: "ODデータ管理",
                actions: {
                    import: "インポート",
                    delete: "削除",
                    downloadTemplate: "テンプレートをダウンロード",
                },
                messages: {
                    importingCsv: "CSVを読み込んでいます...",
                    importedData: "インポート済みODデータ",
                },
                labels: {
                    filename: "ファイル名",
                    importedAt: "インポート日時",
                    scenarioRequired: "シナリオ",
                    fileDrop:
                        "ファイルをここにドラッグ＆ドロップ、またはクリックして選択してください",
                    fileAccept: "対応形式：CSV",
                },
                warnings: {
                    gtfsEdited:
                        "このシナリオはGTFS編集で作成されたものです。利用実績・ODが停留所に正しく表示されないことがあります。",
                },
                errors: {
                    scenarioNotSelected: "シナリオが未選択です。",
                    importFailed: "CSVのインポートに失敗しました",
                    requiredColumnsPrefix: "必要な列:",
                },
                defaults: {
                    uploadedFilename: "ODデータ",
                },
            },
            legend: {
                busStopTitle: "バス停OD凡例",
                headers: {
                    caption: "表記",
                    users: "利用者数",
                    matchedStops: "該当停留所数",
                    stops: "停留所数",
                    lineCount: "本数",
                },
                units: {
                    items: "件",
                    lines: "本",
                },
            },
            map: {
                visualizations: {
                    usageDistribution: "停留所別利用者数",
                    flowMap: "OD流動図",
                    busVolume: "OD量の可視化",
                    default: "ODマップ",
                },
                suffixes: {
                    sum: "（合計）",
                    origin: "（乗車）",
                    dest: "（降車）",
                    firstStop: "（起点）",
                    lastStop: "（終点）",
                },
            },
        },
        upload: {
            resultTitle: "ODデータインポート結果",
            invalidCsvHeaders:
                "CSV header is invalid. Required: date, agency_id, route_id, stopid_geton, stopid_getoff, count",
            invalidRecordsTitle: "無効なレコード（形式エラー）",
            tableHeaders: {
                row: "行",
                reason: "理由",
            },
            noInvalidRows: "形式エラーの行はありません",
            getonStops: "乗車停留所",
            getoffStops: "降車停留所",
            gtfsMissingGetonStops: "GTFSデータに存在しない乗車停留所",
            gtfsMissingGetoffStops: "GTFSデータに存在しない降車停留所",
            gtfsAvailableGetonStops: "GTFSデータに存在する乗車停留所",
            gtfsAvailableGetoffStops: "GTFSデータに存在する降車停留所",
        },
    },
};
