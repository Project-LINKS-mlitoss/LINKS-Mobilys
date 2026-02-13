// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
/**
 * Scenario-related Japanese strings.
 *
 * Purpose: strings specific to the scenario domain (tabs/labels/forms/buttons).
 */

export const SCENARIO = {
  common: {
    selectScenarioFirst: "まずシナリオを選択してください",
  },
  editEntry: {
    title: "シナリオ一覧",
    actions: {
      createFromClone: "シナリオを複製して新規作成",
    },
    deleteDialog: {
      title: "シナリオの削除確認",
      messageTemplate: "シナリオ「{name}」を削除しますか？",
      cancel: "キャンセル",
      confirm: "削除",
    },
    snackbar: {
      deleted: "シナリオを削除しました。",
      deleteFailed: "シナリオの削除に失敗しました。",
      renamed: "シナリオ名を更新しました。",
      renameFailed: "シナリオ名の更新に失敗しました。",
      exportFilesLoadFailed: "エクスポート対象ファイル取得に失敗しました",
      exportFailed: "エクスポートに失敗しました",
    },
  },
  editPage: {
    title: "シナリオ編集",
    back: {
      toHome: "ホームに戻る",
    },
    tabs: {
      groupingFix: "グルーピング修正",
      gtfsDataEdit: "GTFSデータ編集",
    },
    flowTitles: {
      timetable: "時刻表を変更",
      route: "路線（経路）を作成して、便を追加",
      stops: "標柱の追加・変更及び、それに伴う路線（経路）の変更",
    },
    flowSteps: {
      timetable: [
        {
          title: "便の編集",
          sub:
            "便を選択して時刻表を編集。新規便の作成は、既存便を複製して編集できます。",
        },
        {
          title: "フィード基本情報の編集",
          sub: "フィードの有効開始日・終了日の設定を行う",
        },
      ],
      route: [
        {
          title: "路線・運行パターンを編集",
          sub:
            "往路便・復路便それぞれの運行パターン（経路）を新規作成。既存運行パターンを複製して編集も可能",
        },
        {
          title: "便の編集",
          sub: "作成した路線の便を作成し、時刻を設定する",
        },
        {
          title: "フィード基本情報の編集",
          sub: "フィードの有効開始日・終了日の設定を行う",
        },
      ],
      stops: [
        {
          title: "標柱の編集",
          sub: "標柱の新規作成・名称や位置の変更を行う",
        },
        {
          title: "路線・運行パターンを編集",
          sub:
            "作成した標柱を含む経路の新規作成を行い、往復区別や運行日を設定する",
        },
        {
          title: "便の編集",
          sub: "路線の便を追加し、時刻表の設定を行う",
        },
        {
          title: "フィード基本情報の編集",
          sub: "フィードの有効開始日・終了日の設定を行う",
        },
      ],
    },
  },
  gtfsDataTabs: {
    tabs: {
      feedInfo: "フィード基本情報の編集",
      calendar: "運行日の編集",
      stops: "停留所・標柱の編集",
      routeCut: "路線区間の短縮",
      trips: "便の編集",
    },
  },
  groupingTab: {
    tabs: {
      stopGrouping: "停留所のグルーピング",
      routeGrouping: "路線のグルーピング",
      patternEdit: "運行パターンの編集",
    },
  },
  pickerTile: {
    loading: "シナリオを読み中",
    placeholder: "シナリオを選択",
    cloneButton: "複製して新規作成",
    cloneDialog: {
      title: "新規シナリオの作成",
      sourceLabel: "複製するシナリオ",
      sourcePlaceholder: "複製するシナリオを選択",
      nameLabel: "新規シナリオ",
      namePlaceholder: "新規シナリオの名称を入力",
      cancel: "キャンセル",
      submit: "新規作成",
      submitting: "作成中…",
    },
    validation: {
      requiredScenarioName: "必須項目です。",
      duplicateScenarioName:
        "同じ名前のシナリオが既に存在しています。シナリオ名を変更してください。",
    },
    snackbar: {
      cloneSuccess: "シナリオを作成しました。",
      internalError: "内部エラーが発生しました",
    },
  },
  detail: {
    backToList: "シナリオ一覧に戻る",
    title: "シナリオ詳細",
    exportButton: "シナリオエクスポート",
    tabs: {
      detail: "シナリオ詳細",
      validation: "データチェック結果",
    },
    loading: "データを読み込み中...",
    export: {
      downloadInProgress: "ダウンロード中...",
      exportFailed: "エクスポートに失敗しました",
      exportFilenamePrefix: "gtfs_export_",
    },
  },
  home: {
    sections: {
      import: {
        title: "GTFSデータインポート",
        tiles: {
          fromRepo: {
            title: "GTFSデータリポジトリから",
            desc: "GTFSデータリポジトリからデータをインポートします",
          },
          fromLocal: {
            title: "ローカル環境から",
            descLine1: "PCに保存されたGTFSデータ",
            descLine2: "（Zipファイル）をインポートします",
          },
        },
      },
      analysis: {
        title: "分析",
        tiles: {
          visualization: {
            title: "データの可視化",
            desc:
              "サービスレベル評価に必要な運行頻度や到達可能なエリアを地図やグラフで把握できます。",
          },
          boardingAlighting: {
            title: "乗降分析",
            desc: "路線や停留所の乗降車数や通過人員を、時間帯別に分析できます。",
          },
          odAnalysis: {
            title: "ODデータ分析",
            descLine1: "Origin（起点）と",
            descLine2:
              "Destination（終点）を分析し、人の移動の流れを把握することができます。",
          },
        },
      },
      simulation: {
        title: "シミュレーション",
        tiles: {
          simple: {
            title: "かんたん便数編集",
            desc:
              "路線の増便・減便数を設定し、かんたんに将来シナリオを作成できます。",
          },
          full: {
            title: "シミュレーション",
            desc:
              "現行シナリオと将来シナリオを比較して、費用便益を算出します。",
          },
        },
      },
      guidedEdit: {
        title: "ガイド付きGTFS編集",
        tiles: {
          picker: {
            title: "シナリオを作成",
            desc: "シナリオを新規作成、あるいは選択してください",
          },
          timetable: {
            title: "時刻表を変更",
            desc: "便ごとに発着時刻を編集できます",
          },
          route: {
            title: "路線（経路）を変更",
            desc: "路線（経路）の情報を編集できます",
          },
          stops: {
            title: "標柱の追加・変更 それに伴う路線変更",
            desc: "標柱の追加・変更及び、それに伴う路線（経路）情報を編集できます",
          },
        },
      },
      edit: {
        title: "GTFS編集",
        tiles: {
          edit: {
            title: "GTFS編集",
            desc: "ユーザー自身で色々な編集をすることができます",
          },
        },
      },
    },
  },
};
