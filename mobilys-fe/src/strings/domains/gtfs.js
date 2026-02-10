/**
 * GTFS-related Japanese strings (UI text).
 *
 * Purpose: UI strings specific to GTFS (import, validation, tabs, etc).
 * Note: GTFS constants (mappings/options) live in `src/constant/gtfs.js`.
 */

export const GTFS = {
  common: {
    actions: {
      cancel: "キャンセル",
      save: "保存",
      reset: "リセット",
      update: "更新",
      close: "閉じる",
      detail: "詳細",
      export: "エクスポート",
      create: "作成",
      delete: "削除",
    },
    placeholders: {
      unnamedScenario: "Unnamed scenario",
      na: "N/A",
    },
    status: {
      processing: "処理中...",
      preparing: "準備中",
      completed: "完了しました",
    },
  },
  import: {
    title: "GTFSデータインポート",
    tabs: {
      fromRepo: "GTFSデータリポジトリから取得",
      fromLocal: "ローカルからインポート",
    },
    filters: {
      unselected: "未選択",
    },
    errors: {
      fetchFeedsFailed: "データの取得に失敗しました",
    },
    api: {
      filters: {
        prefecture: "都道府県",
        organization: "事業者名",
        feedNamePlaceholder: "フィード名",
      },
      table: {
        headers: {
          organizationName: "事業者名",
          prefecture: "都道府県",
          gtfsFeedName: "GTFSフィード名",
          license: "ライセンス",
          latestFeedStartDate: "最新フィード開始日",
          latestFeedEndDate: "最新フィード終了日",
          lastPublishedAt: "最終公開日",
          detail: "詳細",
        },
        licenseSourceTemplate: "公開元: {organizationName}",
        emptyMessage: "データがありません",
      },
    },
    local: {
      title: "ファイルインポート",
      validation: {
        required: "必須項目です。",
        duplicateScenarioName:
          "同じ名前のシナリオが既に存在しています。シナリオ名を変更してください。",
      },
      errors: {
        importFailed: "ファイルのインポートに失敗しました",
        validationFailed: "ファイルの検証に失敗しました",
        internalError: "内部エラーが発生しました",
        externalError: "外部エラーが発生しました",
      },
      snackbar: {
        startedTitle: "インポートを開始しました",
        startedDetailTemplate: "{scenarioName} のインポート処理をバックグラウンドで実行しています",
      },
      uploader: {
        emptyText:
          "ファイルをここにドラッグ＆ドロップ、またはクリックして選択してください",
        acceptLabel: "対応形式：ZIP",
      },
      scenarioInput: {
        title: "シナリオ名の入力",
        label: "シナリオ名",
        confirmLabel: "インポート",
        cancelLabel: "キャンセル",
      },
      actions: {
        import: "インポート",
      },
      removeIcon: "x",
    },
    errorModal: {
      title: "エラー詳細",
      occurredAtLabel: "発生時刻:",
      noRowDetailsFallback:
        "行単位の詳細はありません。エラー内容は通知に表示されました。",
      listTitle: "エラー一覧",
      countSuffixTemplate: "{count}件",
      showingCountTemplate: "{count}件を表示中",
      table: {
        headers: {
          file: "ファイル",
          rowNumber: "行番号",
          field: "フィールド",
          errorContent: "エラー内容",
        },
      },
      meta: {
        source: "ソース:",
        code: "コード:",
      },
    },
    detail: {
      feedInfo: {
        publisherName: "提供組織名",
        publisherUrl: "提供組織 URL",
        feedLang: "提供言語",
        feedStartDate: "有効期間開始日",
        feedEndDate: "有効期間終了日",
        feedVersion: "提供データバージョン",
      },
      dataFiles: {
        title: "データファイル一覧",
        table: {
          headers: {
            fileName: "データファイル名",
            count: "データ数",
          },
          empty: "データがありません",
        },
      },
      stopGroupTab: {
        groupOptions: {
          label: "グループオプション",
          pendingApplyLabel: "グループオプション（保存で反映）",
          byName: "標柱名称",
          byId: "標柱ID",
          help: {
            line1: "初期設定では、停留所は標柱名称（stop_name）でグループしています。",
            line2: "グループオプションよりグループ単位を標柱ID（stop_id）に変更できます。",
          },
        },
        table: {
          headers: {
            stopId: "停留所ID",
            stopName: "停留所名称",
            stopLat: "停留所緯度",
            stopLon: "停留所経度",
            poleId: "標柱ID",
            poleName: "標柱名称",
            poleLat: "緯度",
            poleLon: "経度",
            poleCode: "標柱番号",
            poleLocationType: "標柱区分",
            oldGroup: "旧グループ",
            newGroup: "新グループ",
          },
        },
        actions: {
          showMap: "地図表示",
          editId: "IDを編集",
          editName: "名称を編集",
        },
        dialogs: {
          confirmTitle: "停留所グループの変更",
          confirmBody: "以下の内容で更新します。よろしいですか？",
          noChanges: "変更はありません。",
          mapTitle: "停留所グループの地図",
          leaveTitle: "このページを離れますか？",
          leaveBody: "未保存の変更があります。破棄して移動しますか？",
          discardAndLeave: "破棄して移動",
        },
      },
      routeGroupTab: {
        mapTool: {
          title: "地図ツール",
          aria: {
            expand: "展開する",
            collapse: "折りたたむ",
          },
        },
        actions: {
          newGroup: "新規グループ作成",
          showMap: "地図表示",
          editName: "名称を編集",
          dropToAdd: "ここにドロップして追加",
        },
        help: {
          directionAutofill: {
            line1: "インポートしたGTFSデータに往復区分が設定されていない場合、",
            line2: "システムが自動で値を補完します。補完された値は 青字 で表示されます。",
            line3: "往復区分を変更する場合は、「運行パターンの編集」で修正してください。",
          },
          systemGeneratedInitialValue: "システム生成の初期値です。必要に応じて変更できます。",
          noPatterns: "パターンなし",
        },
        filters: {
          keyword: "キーワードフィルター",
        },
        table: {
          headers: {
            routeGroup: "路線グループ",
            routeId: "路線ID",
            routeShortName: "路線略称",
            routeLongName: "路線名",
            patternId: "路線内の運行パターンID",
            direction: "往復",
            serviceId: "運行日",
            segment: "運行区間",
            keyword: "キーワード",
            oldGroup: "旧グループ",
            newGroup: "新グループ",
          },
        },
        dialogs: {
          confirmTitle: "路線グループの変更",
          confirmBody: "以下の内容で更新します。よろしいですか?",
          newGroupTitle: "路線グループの新規作成",
          groupNameLabel: "グループ名",
          deleteTitle: "路線グループの削除",
          deleteBodyTemplate: "「{groupName}」を削除します。よろしいですか?",
        },
      },
    },
  },
  feedDetail: {
    titleFallback: "フィード詳細",
    empty: {
      noData: "データがありません",
      noFiles: "ファイルがありません。",
    },
    table: {
      headers: {
        generation: "世代",
        publishedAt: "公開日",
        startDate: "開始日",
        endDate: "終了日",
        updateInfo: "更新情報",
        updateMemo: "更新メモ",
        import: "インポート",
      },
      labels: {
        current: "現行",
      },
    },
    backdrop: {
      title: "検証中...",
      detail: "GTFSデータの検証を行っています",
    },
    updateInfo: {
      timetable: "ダイヤ改正",
      stops: "バス停の追加/更新/削除",
      availablePeriod: "データ有効期間の更新",
      routes: "路線の追加/更新/削除",
      fare: "運賃の更新",
      temporaryTimetable: "臨時ダイヤ",
      others: "その他",
    },
  },
  validationTab: {
    actions: {
      refresh: "チェック結果更新",
      running: "バリデーション実行中...",
    },
    loading: {
      fetchingReport: "GTFSバリデーション結果を取得しています…",
    },
    empty: {
      title: "バリデーション結果がありません",
      description:
        "「チェック結果更新」ボタンを押して、GTFS データを検証してください。",
    },
    errors: {
      missingScenarioId:
        "scenarioId が指定されていません。親コンポーネントを確認してください。",
      runFailed: "GTFSバリデーションの実行に失敗しました。",
    },
    snackbar: {
      validationTriggered: "GTFSバリデーションを実行しました。",
      exportCompleted: "シナリオのエクスポートが完了しました。",
    },
    validator: {
      summary: {
        title: "GTFS スケジュールバリデーションレポート",
        validatedAtTemplate: "バリデーション実行日時：{date}",
        unnamedScenario: "Unnamed scenario",
        na: "N/A",
      },
      notices: {
        empty: "通知はありません。",
        sections: {
          fixable: "修正可能な通知",
          results: "検証結果",
          excluded: "除外した通知",
        },
        summaryTemplate:
          "合計 {total} 件の通知があります （エラー {error} 件・警告 {warning} 件・情報 {info} 件）。",
        truncatedFixableTemplate: "表示件数は通知グループ最大 {limit} 件までです。",
        truncatedTemplate: "表示件数を {limit} 通知グループまでに制限しています。",
        excludedDescription:
          "以下の通知は、システムの利用には問題ないため集計から除外しています。",
        table: {
          headers: {
            code: "通知コード",
            severity: "重大度",
            count: "件数",
          },
        },
      },
      noticeDetail: {
        docsLink: {
          prefix: "この通知の詳細な説明は ",
          linkText: "こちら",
          suffix: " を参照してください（英語）。",
        },
        limitTemplate: "件数が多いため、下表には {total} 件中 {display} 件を表示しています。",
        noSamples: "この通知に対するサンプルレコードはありません。",
        na: "N/A",
      },
    },
  },
  routeGroup: {
    editNameModal: {
      title: "路線グループ名の編集",
      fields: {
        groupName: "グループ名",
      },
      validation: {
        required: "名前を入力してください",
        tooLongTemplate: "名前が長すぎます（{max}文字以内）",
      },
      errors: {
        saveFailed: "保存に失敗しました",
      },
    },
  },
  scenario: {
    editModal: {
      title: "編集するレコードを確認してください",
      fields: {
        scenarioName: "シナリオ名",
        startDate: "開始日",
        endDate: "終了日",
      },
    },
    table: {
      headers: {
        scenarioName: "シナリオ名",
        feedName: "フィード名",
        startDate: "開始日",
        endDate: "終了日",
        createdAt: "シナリオ作成日時",
        updatedAt: "シナリオ更新日時",
        creationMethod: "シナリオ作成方法",
      },
      actions: {
        startEdit: "編集を開始",
        startInlineRename: "名前を編集",
      },
      source: {
        owned: "自分",
      },
      creationMethod: {
        api: "GTFSリポジトリより取得",
        local: "ローカルからインポート",
        cloneFromTemplate: "{original}を複製して編集",
        clone: "複製して編集",
      },
      empty: {
        noScenarios: "シナリオがありません",
      },
    },
    multiStepEditModal: {
      title: "シナリオを編集",
      steps: {
        basicInfo: "基本情報",
        calendar: "運行カレンダー",
        exceptions: "特例日",
        confirm: "確認",
      },
      validation: {
        required: "必須です",
        endDateAfterStart: "開始日の翌日以降を選択してください",
      },
      errors: {
        loadContextFailed: "初期データの取得に失敗しました。",
      },
      fields: {
        scenarioName: "シナリオ名",
        startDate: "開始日",
        endDate: "終了日",
        publisherUrl: "発行者URL",
        version: "バージョン",
        versionPlaceholder: "例: 2024.04.01",
        serviceId: "運行日ID",
        scenarioDates: "シナリオ日付",
        useScenarioDates: "全サービスでシナリオ日付を使用",
        start: "開始",
        end: "終了",
        date: "日付",
        type: "タイプ",
      },
      actions: {
        addService: "サービスを追加",
        add: "追加",
        remove: "運休",
        back: "戻る",
        next: "次へ",
      },
      placeholders: {
        selectServiceId: "運行日IDを選択",
        all: "すべて",
        none: "なし",
      },
      tooltips: {
        addService: "サービスを追加",
        delete: "削除",
      },
      helperText: {
        noAddedServices: "追加されたサービスはありません。",
        noExceptions: "特例日はありません。",
        selectServiceHint:
          "まずは運行日IDを選択してください。サービスは「運行カレンダー」で追加した値も候補に含まれます。",
      },
      status: {
        submitting: "送信中...",
      },
      summary: {
        selectedCountTemplate: "選択済み ({count}件)",
      },
      daysShort: ["月", "火", "水", "木", "金", "土", "日"],
      preview: {
        title: "送信内容の確認",
        calendar: "カレンダー",
        exceptions: "特例日",
        noMatches: "該当なし",
      },
      exceptionType: {
        added: "追加",
        removed: "運休",
        addedWithCode: "追加 (1)",
        removedWithCode: "運休 (2)",
      },
    },
  },
  exportModal: {
    title: "シナリオエクスポート",
    errors: {
      missingScenarioInfo: "シナリオ情報がありません",
      exportFailed: "エクスポートに失敗しました",
    },
    labels: {
      targetFiles: "エクスポート対象のファイル:",
      noTargetFiles: "対象ファイルがありません",
    },
  },
  map: {
    attribution: {
      gsiHtml: '© <a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a>',
    },
    baseLayers: {
      pale: "淡色地図",
      std: "標準地図",
      blank: "白地図",
      photo: "写真",
    },
    layers: {
      routeColors: "路線カラー",
    },
    errors: {
      renderFailed: "地図の描画に失敗しました。",
    },
    empty: {
      noCoordinates: "座標が未設定のため地図を表示できません。",
      noData: "データが見つかりません。",
    },
    panel: {
      legend: "凡例",
      layers: "レイヤー",
      map: "地図",
    },
    legendItems: {
      stop: "停留所",
      pole: "標柱",
    },
  },
};
