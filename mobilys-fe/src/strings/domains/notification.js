/**
 * Notification-related Japanese strings.
 *
 * Purpose: strings specific to notifications (popover labels, modal titles, etc).
 */

export const NOTIFICATION = {
  popover: {
    title: "お知らせ",
    markAllReadTitle: "すべて既読にする",
    markAllRead: "すべて既読",
    empty: "お知らせはありません。",
    snackbar: {
      markAllReadSuccess: "すべての通知を既読にしました",
      markAllReadFailed: "すべての通知を既読に失敗しました",
      markReadFailed: "通知の既読処理に失敗しました",
      detailUnavailable: "通知の詳細を取得できませんでした",
      detailFetchFailed: "通知の詳細取得に失敗しました",
      scenarioDeletedFallback: "このシナリオは既に削除されています。",
    },
  },
  errorDetails: {
    title: "検証結果詳細",
    occurredAtLabel: "発生時刻:",
    severity: {
      error: "エラー",
      warning: "警告",
      info: "情報",
    },
    summaryChipLabelTemplate: ({ label, count }) => `${label}：${count}件`,
    sampleTitleTemplate: ({ max, total }) => `サンプルデータ（最大${max}件表示 / 全${total}件）`,
    fileName: "ファイル名",
    description: "説明",
    japanNote: "日本向け注",
    matchedCountTemplate: (count) => `${count}件の該当データ`,
    noDetails: "エラーの詳細情報がありません。",
    resultsTitle: "検証結果",
    excludedTitle: "除外した通知",
    excludedDescription:
      "以下の通知は、システムの利用には問題ないため集計から除外しています。",
    emptyResults: "表示できる検証結果がありません。",
  },
};
