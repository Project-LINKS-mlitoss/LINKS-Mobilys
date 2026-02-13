// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
/**
 * Route-related Japanese strings.
 *
 * Purpose: strings specific to the route domain (route edit, route groups, patterns, etc).
 */

export const ROUTE = {
  easyTripFrequency: {
    title: "かんたん便数編集",
    scenarioPicker: {
      label: "シナリオ",
      placeholder: "シナリオを選択",
    },
    actions: {
      createScenarioFromClone: "シナリオを複製して新規作成",
      save: "保存",
    },
    helper: {
      selectScenario: "シナリオを選択してください。",
    },
    snackbar: {
      saved: "便数を保存しました。",
      saveFailed: "便数の保存に失敗しました。",
      scenarioCreated: "シナリオを作成しました。",
      scenarioCreateFailed: "シナリオの作成に失敗しました",
    },
  },
  routeGroupingTab: {
    snackbar: {
      updated: "路線グルーピングを更新しました",
      updateFailed: "路線グルーピングの更新に失敗しました",
      groupCreated: "路線グループを作成しました",
      groupCreateFailed: "路線グループの作成に失敗しました",
      colorUpdateFailed: "路線グループ色の更新に失敗しました",
      groupDeleted: "路線グループを削除しました",
      groupDeleteFailed: "路線グループの削除に失敗しました",
      groupRenamed: "路線グループ名を更新しました",
      groupRenameFailed: "路線グループ名の更新に失敗しました",
      loadFailed: "路線グループの取得に失敗しました。",
    },
  },
  routePatternTab: {
    snackbar: {
      routesLoadFailed: "路線の取得に失敗しました",
      routeCreated: "路線を作成しました",
      routeCreateFailed: "路線の作成に失敗しました",
      routeUpdated: "路線を更新しました",
      routeUpdateFailed: "路線の更新に失敗しました",
      routePatternUpdated: "路線パターンを更新しました",
      routeDeleted: "路線を削除しました",
      routeDeleteFailed: "路線の削除に失敗しました",
      shapesSaved: "シェイプを保存しました",
      shapesSaveFailed: "シェイプの保存に失敗しました",
    },
  },
};
