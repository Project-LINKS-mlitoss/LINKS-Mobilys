/**
 * POI-related Japanese strings.
 *
 * Purpose: strings specific to POI import/management.
 */

export const POI = {
  common: {
    all: "すべて",
    none: "なし",
  },
  errors: {
    fetchFailed: "施設データの取得に失敗しました",
    importFailed: "インポートに失敗しました",
    commitFailed: "コミットに失敗しました",
    prefectureSaveFailed: "都道府県の保存に失敗しました",
    deleteBatchFailed: "CSVファイルの削除に失敗しました",
    setActiveBatchFailed: "アクティブバッチの設定に失敗しました",
  },
  template: {
    headers: ["タイプ", "名前", "緯度", "経度", "備考"],
    filename: "poi_template.csv",
  },
};

