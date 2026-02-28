// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
/**
 * Ridership-related Japanese strings.
 *
 * Purpose: strings specific to one-detailed (ridership) upload, records, and export flows.
 */

export const RIDERSHIP = {
  oneDetailed: {
    title: "乗降実績データ",
    description:
      "アップロードされた乗降実績データとGTFSデータの紐づけ処理を行います。アップロードした乗降実績データに含まれる乗車・降車日時と停留所の情報をもとに、利用された路線・便を推測・補完します。処理済みの乗降実績データは、乗降集計データおよび駅・バス停間ODデータとして出力することも可能です。",
    scenarioSelect: {
      label: "シナリオ",
      missing: "シナリオがありません。",
    },
    tabs: {
      uploads: "アップロード履歴",
      records: "レコード",
    },
    alerts: {
      recordsNeedUpload: "レコード表示には最新のアップロードが必要です。先にアップロードしてください。",
    },
    dialog: {
      deleteTitle: "削除確認",
      deleteMessage: "このアップロードと関連するレコードを削除します。よろしいですか？",
      cancel: "キャンセル",
      delete: "削除",
      deleting: "削除中...",
    },
    snackbar: {
      exportCompleted: "エクスポートが完了しました",
      exportCountSuffixTemplate: "（{count}件）",
      exportFailed: "エクスポートに失敗しました。",
      deleted: "削除しました。",
      deleteFailed: "削除に失敗しました。",
    },
    uploadList: {
      title: "アップロード履歴",
      actions: {
        newUpload: "+ 新規アップロード",
        detail: "詳細",
      },
      search: {
        label: "検索",
        placeholder: "データ名 / ファイル名",
      },
      table: {
        headers: {
          recordName: "データ名",
          fileName: "ファイル",
          successRate: "便推定率",
          successTotal: "成功/総行",
          errorCount: "便推定不可",
          uploadedAt: "アップロード日時",
          toleranceMinutes: "遅延時間許容値",
          actions: "操作",
        },
        loading: "読み込み中...",
        empty: "アップロード履歴がありません。",
      },
      tooltips: {
        csvFormat: "CSV形式 (.csv)",
        delete: "削除",
      },
      aria: {
        csvFormat: "CSV形式 (.csv)",
        delete: "削除",
      },
      format: {
        minutesTemplate: "{minutes}分",
      },
    },
    recordList: {
      title: "乗降実績プレビュー",
      filters: {
        upload: "アップロード",
        selectPlaceholder: "選択してください",
        startDate: "開始日",
        endDate: "終了日",
        boardingStationCode: "乗車駅コード",
        alightingStationCode: "降車駅コード",
      },
      table: {
        headers: {
          ridershipRecordId: "乗降実績ID",
          boardingStation: "乗車駅",
          alightingStation: "降車駅",
          boardingAt: "乗車時刻",
          alightingAt: "降車時刻",
          route: "路線",
          trip: "便",
        },
        loading: "読み込み中...",
        empty: "レコードがありません。",
      },
    },
    uploadModal: {
      title: "乗降実績データアップロード",
      fields: {
        recordName: "データ名",
        recordNamePlaceholder: "例: 2025年3月 乗降実績データ",
        toleranceMinutes: "遅延時間許容値",
        fileSelect: "ファイル選択",
        fileDropPrompt: "ファイルをここにドラッグ＆ドロップ、またはクリックして選択してください",
        fileHintTemplate: "対応形式：{types}・最大{maxMb}MB",
        selectedFileTemplate: "選択中: {fileName}（{fileSize}）",
      },
      helperText: {
        toleranceMinutes:
          "実際の乗車時刻や降車時刻は、交通機関の遅れにより時刻表と完全に一致しないことがあります。時刻表と照合する際の遅延許容範囲を設定してください。",
      },
      validation: {
        selectFile: "ファイルを選択してください。",
        invalidFormatTemplate: "対応形式が正しくありません（{types} を選択してください）。",
        fileTooLargeTemplate: "ファイルサイズは最大{maxMb}MBです。",
        scenarioRequired: "シナリオを選択してください。",
        recordNameRequired: "データ名は必須です。",
        toleranceInvalidTemplate: "遅延時間許容値は{options}分から選択してください。",
      },
      snackbar: {
        started:
          "アップロードを開始しました。完了まで時間がかかる場合があります（画面を移動しても処理は続きます）。",
        completed: "アップロードが完了しました。",
        failed: "アップロードに失敗しました。",
      },
      actions: {
        cancel: "キャンセル",
        upload: "アップロード",
        uploading: "アップロード中...",
      },
    },
    uploadDetail: {
      titleFallback: "アップロード詳細",
      loading: "読み込み中...",
      meta: {
        fileNameLabel: "ファイル名:",
        sizeLabel: "サイズ:",
        validationModeLabel: "検証モード:",
        uploadedAtLabel: "アップロード日時:",
        processedAtLabel: "処理完了日時:",
      },
      summary: {
        totalRows: "総行数",
        success: "成功",
        error: "エラー",
      },
      rawDataTable: {
        empty: "元データはありません。",
        headers: {
          key: "キー",
          value: "値",
        },
      },
      errors: {
        titleTemplate: "エラー一覧（{total}件{groupPart}）",
        groupPartTemplate: " / {groups}グループ",
        none: "エラーはありません。",
        affectedRowsLabel: "影響行:",
        noDetails: "詳細はありません。",
        rowLabelTemplate: "行 {row}",
        rawDataTitle: "元データ",
        groupTitleTemplate: "{label} - {field}({count}件)",
      },
      actions: {
        close: "閉じる",
      },
    },
    statusBadge: {
      labels: {
        processing: "処理中",
        completed: "成功",
        partial: "一部成功",
        failed: "失敗",
      },
    },
  },
  boardingAlighting: {
    title: "乗降集計データ",
    description: "乗降実績データ（アップロード履歴）から乗降集計データ（CSV形式）を作成します。",
    scenarioSelect: {
      label: "シナリオ",
    },
    search: {
      label: "検索",
      placeholder: "データ名 / ファイル名",
    },
    table: {
      headers: {
        recordName: "データ名",
        fileName: "ファイル",
        successRate: "便推定率",
        successTotal: "成功/総行",
        errorCount: "便推定不可",
        uploadedAt: "アップロード日時",
        actions: "操作",
      },
      loading: "読み込み中...",
      empty: "アップロード履歴がありません。",
    },
    actions: {
      downloadCsv: "乗降集計データを作成",
      disabledTooltip: "completed / partial のみ変換可能",
    },
    dialog: {
      title: "CSV作成の確認",
      message:
        "乗降実績データ（アップロード履歴）から乗降集計データ（CSV形式）を作成してダウンロードします。よろしいですか？",
      fileLabel: "元ファイル:",
      hint: "作成処理に時間がかかる場合があります。",
      cancel: "キャンセル",
      confirm: "作成",
      confirming: "作成中...",
    },
    snackbar: {
      exportCompleted: "CSVをダウンロードしました",
      exportFailedTitle: "変換に失敗しました",
    },
    fileName: {
      defaultRecordName: "ridership_upload",
      defaultSuffix: "_jyoukou.csv",
    },
  },
  odData: {
    title: "駅・バス停間ODデータ",
    description: "乗降実績データ（アップロード履歴）から駅・バス停間ODデータ（CSV）を作成します。",
    scenarioSelect: {
      label: "シナリオ",
    },
    search: {
      label: "検索",
      placeholder: "データ名 / ファイル名",
    },
    table: {
      headers: {
        recordName: "データ名",
        fileName: "ファイル",
        successRate: "便推定率",
        successTotal: "成功/総行",
        errorCount: "便推定不可",
        uploadedAt: "アップロード日時",
        actions: "操作",
      },
      loading: "読み込み中...",
      empty: "アップロード履歴がありません。",
    },
    actions: {
      downloadCsv: "駅・バス停間ODデータを作成",
      disabledTooltip: "completed / partial のみ変換可能",
    },
    dialog: {
      title: "CSV作成の確認",
      message:
        "乗降実績データ（アップロード履歴）から駅・バス停間ODデータ（CSV）を作成してダウンロードします。よろしいですか？",
      fileLabel: "元ファイル:",
      hint: "作成処理に時間がかかる場合があります。",
      cancel: "キャンセル",
      confirm: "作成",
      confirming: "作成中...",
    },
    snackbar: {
      exportCompleted: "駅・バス停間ODデータ（CSV形式）をダウンロードしました",
      exportFailedTitle: "変換に失敗しました",
    },
    fileName: {
      defaultRecordName: "ridership_upload",
      defaultSuffix: "_OD.csv",
    },
  },
};
