/**
 * Auth-related Japanese strings.
 *
 * Purpose: strings specific to authentication flows (login, session).
 */

export const AUTH = {
  login: {
    title: "ログインページ",
    fields: {
      username: {
        label: "ユーザー名",
        placeholder: "ユーザーを入力してください。",
        helperText: "登録済みのユーザー名を入力してください。",
      },
      password: {
        label: "パスワード",
        placeholder: "パスワードを入力してください。",
      },
    },
    actions: {
      submit: "ログイン",
      cancel: "キャンセル",
      confirm: "決定",
      loginWithoutProject: "プロジェクト無しでログイン",
    },
    dialogs: {
      projectSelect: {
        title: "プロジェクトを選択してください",
        fieldLabel: "プロジェクト",
      },
    },
    validation: {
      usernameRequired: "ユーザー名は必須です。",
      usernameNoSpaces: "スペースを含めないでください。",
      usernameMax: "254文字以下で入力してください。",
      passwordRequired: "パスワードは必須です。",
      passwordNoSpaces: "パスワードにスペースを含めないでください。",
    },
    errors: {
      title: "検証エラー",
      noAssignableProjects: "割り当て可能なプロジェクトが見つかりませんでした。",
      noProjectAssigned: "まだどのプロジェクトにも割り当てられていません。管理者に連絡してください。",
      invalidCredentials: "認証情報が無効です。ユーザー名とパスワードを確認してください。",
      loginFailedTryAgain: "ログインに失敗しました。しばらくしてからもう一度お試しください。",
      loginFailed: "ログインに失敗しました。",
      loginFailedAfterProjectSelection: "プロジェクト選択後のログインに失敗しました。",
    },
  },
};

