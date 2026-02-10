/**
 * Map-related Japanese strings.
 *
 * Purpose: strings specific to map selection and map UI flows.
 */

export const MAP = {
  baseLayers: {
    title: "地図",
    aria: {
      open: "レイヤー",
    },
    labels: {
      pale: "淡色地図",
      std: "標準地図",
      blank: "白地図",
      photo: "写真",
    },
  },
  selector: {
    title: "地図を選択",
    loadingMapList: "地図リストを読み込み中...",
    mapUrlMissing: "地図URLがありません。ログインしてから再度お試しください。",
    attributionHtml: '&copy; <a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a>',
    snackbar: {
      loadMapListFailed: "地図リストの読み込みに失敗しました",
      updateMapFailed: "地図の変更に失敗しました",
    },
  },
};
