// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
/**
 * User-management related Japanese strings.
 *
 * Purpose: strings specific to user/role/org/project management.
 */

export const USER = {
  userManagement: {
    title: "ユーザー管理",
    tabs: {
      users: "ユーザー管理",
      roles: "ロール管理",
      organizations: "組織管理",
      projects: "プロジェクト管理",
    },
    common: {
      actions: {
        cancel: "キャンセル",
        save: "保存",
        saving: "保存中...",
        edit: "変更",
        delete: "削除",
        deleting: "削除中...",
        add: "追加",
        remove: "解除",
        removing: "解除中...",
        close: "閉じる",
      },
      status: {
        active: "有効",
        inactive: "無効",
      },
      placeholders: {
        none: "なし",
        noData: "データがありません",
      },
    },
    usersTab: {
      actions: {
        create: "新規ユーザー作成",
      },
      table: {
        headers: {
          username: "ユーザー名",
          role: "ロール",
          organization: "組織",
          createdAt: "作成日",
          active: "有効",
        },
        empty: "ユーザーがありません。",
      },
      dialog: {
        title: {
          create: "新しいユーザーを作成",
          edit: "ユーザーを編集",
        },
        fields: {
          username: "ユーザー名",
          password: "パスワード",
          passwordConfirm: "パスワード（再入力）",
          role: "ロール",
          organization: "組織",
          active: "有効",
        },
        helperText: {
          usernameMinTemplate: "最小{min}文字",
          passwordHint: "8文字以上を推奨",
          passwordConfirmHint: "確認のため同じパスワードを入力",
        },
        tooltips: {
          show: "表示する",
          hide: "非表示にする",
          ariaShowPassword: "パスワードを表示",
          ariaHidePassword: "パスワードを非表示",
        },
      },
      validation: {
        duplicateUsername: "このユーザー名は既に存在します。",
        requiredFields: "ユーザー名、パスワード、ロールは必須です。",
        usernameMinTemplate: "ユーザー名は{min}文字以上で入力してください。",
        checkInput: "入力内容を確認してください。",
        passwordRequired: "パスワードは必須です。",
        passwordMinTemplate: "パスワードは{min}文字以上で入力してください。",
        passwordConfirmRequired: "確認用パスワードを入力してください。",
        passwordMismatch: "パスワードが一致しません。",
      },
      snackbar: {
        updated: "ユーザーを更新しました。",
        created: "新しいユーザーを作成しました。",
        deleted: "ユーザーを削除しました。",
        saveFailed: "保存に失敗しました。",
        deleteFailed: "削除に失敗しました。",
        toggled: "有効状態を切り替えました。",
        toggleFailed: "切替に失敗しました。",
      },
      deleteDialog: {
        title: "ユーザー削除の確認",
        messageTemplate: "「{username}」を削除しますか？",
      },
    },
    rolesTab: {
      actions: {
        create: "新規ロール作成",
        viewAccess: "アクセスを見る",
      },
      table: {
        headers: {
          roleName: "ロール名",
          roleLevel: "ロールレベル",
          createdAt: "作成日",
        },
        empty: "ロールがありません。",
      },
      dialog: {
        title: {
          create: "新しいロールを作成",
          edit: "ロールを編集",
        },
        fields: {
          roleName: "ロール名",
          roleLevel: "ロールレベル",
          access: "アクセス",
        },
        accessPicker: {
          placeholderLoading: "読み込み中...",
          placeholder: "アクセスを検索/選択",
        },
      },
      validation: {
        roleNameRequired: "ロール名は必須です。",
        roleLevelRequired: "ロールレベルを選択してください。",
      },
      snackbar: {
        updated: "ロールを更新しました。",
        created: "新しいロールを作成しました。",
        deleted: "ロールを削除しました。",
        saveFailed: "保存に失敗しました。",
        deleteFailed: "削除に失敗しました。",
        accessListFailed: "アクセス一覧の取得に失敗しました。",
      },
      deleteDialog: {
        title: "ロール削除の確認",
        messageTemplate: "「{roleName}」を削除しますか？",
      },
      accessDetail: {
        title: "アクセス一覧",
        table: {
          headers: {
            name: "アクセス名",
            code: "コード",
          },
          empty: "アクセスがありません。",
        },
      },
    },
    organizationTab: {
      actions: {
        create: "新規組織作成",
      },
      table: {
        headers: {
          name: "組織名",
          section: "所属情報",
          organizer: "承認者",
          createdAt: "作成日時",
          active: "有効",
        },
      },
      dialog: {
        title: {
          create: "新しい組織を作成",
          edit: "組織を編集",
        },
        fields: {
          name: "組織名",
          section: "所属情報",
          organizer: "承認者",
          active: "有効",
        },
        placeholders: {
          sectionExample: "例: 営業部 / 企画課",
        },
      },
      validation: {
        nameRequired: "組織名は必須です。",
      },
      snackbar: {
        updated: "組織を更新しました。",
        created: "新しい組織を作成しました。",
        deleted: "組織を削除しました。",
        saveFailed: "保存に失敗しました。",
        deleteFailed: "削除に失敗しました。",
        updateFailed: "更新に失敗しました。",
        toggled: "有効状態を切り替えました。",
      },
      deleteDialog: {
        title: "組織削除の確認",
        messageTemplate: "「{organizationName}」を削除しますか？",
      },
    },
    projectTab: {
      actions: {
        create: "新規プロジェクト作成",
        addOrganization: "組織を追加",
        addUser: "ユーザーを追加",
        edit: "変更",
        add: "追加",
      },
      table: {
        headers: {
          projectName: "プロジェクト名",
          description: "説明",
          createdAt: "作成日時",
          active: "有効",
          organizationName: "組織名",
          userCount: "ユーザー数",
          username: "ユーザー名",
          role: "ロール",
          enabled: "有効",
        },
        empty: {
          projects: "プロジェクトがありません。",
          users: "ユーザーなし",
        },
      },
      dialog: {
        title: {
          create: "新しいプロジェクトを作成",
          edit: "プロジェクトを編集",
          deleteConfirm: "プロジェクト削除の確認",
          addOrganization: "組織を追加",
          addUser: "ユーザーを追加",
          removeOrganization: "組織の解除",
          removeUser: "ユーザーの解除",
        },
        fields: {
          projectName: "プロジェクト名",
          description: "説明",
          active: "有効",
          selectOrganization: "組織を選択",
          selectUser: "ユーザーを選択",
        },
        placeholders: {
          searchOrganization: "組織を検索…",
          searchUser: "ユーザーを検索…",
          unknownOrganization: "（不明な組織）",
          unknownUser: "（不明なユーザー）",
          noOrganization: "（組織なし）",
          organizationUnknown: "（組織不明）",
        },
        helperText: {
          orgAddedAutoLink: "追加した組織に所属するユーザーも自動的に関連づけて表示します。",
          userAddedAutoOrg: "追加したユーザーの所属組織も自動的に表示されます（所属がある場合）。",
        },
      },
      tooltips: {
        removeOrganization: "組織を解除",
        removeUser: "ユーザーを解除",
      },
      validation: {
        nameRequired: "プロジェクト名は必須です。",
      },
      snackbar: {
        updated: "プロジェクトを更新しました。",
        created: "新しいプロジェクトを作成しました。",
        createdFailed: "プロジェクトの作成に失敗しました。",
        deleted: "プロジェクトを削除しました。",
        saveFailed: "保存に失敗しました。",
        deleteFailed: "削除に失敗しました。",
        fetchUsersFailed: "プロジェクトのユーザー取得に失敗しました。",
        toggleSuccess: "プロジェクトの有効状態を切り替えました。",
        toggleFailed: "有効状態の切替に失敗しました。",
        linksUpdated: "組織/メンバーを更新しました。",
        addOrgFailed: "組織の追加に失敗しました。",
        removedOrg: "組織を解除しました。",
        removeOrgFailed: "組織の解除に失敗しました。",
        addedUser: "ユーザーを追加しました。",
        addUserFailed: "ユーザーの追加に失敗しました。",
        removedUser: "ユーザーを解除しました。",
        removeUserFailed: "ユーザーの解除に失敗しました。",
      },
      confirm: {
        deleteProjectTemplate: "「{projectName}」を削除しますか？",
        removeOrganizationTemplate: "プロジェクトから「{organizationName}」を解除しますか？",
        removeUserTemplate: "このプロジェクトからユーザー「{username}」を解除しますか？",
      },
    },
  },
  passwordChange: {
    title: "パスワード変更",
    table: {
      headers: {
        username: "ユーザー名",
        role: "ロール",
        organization: "組織",
        createdAt: "作成日",
        actions: "",
      },
      empty: "表示できるユーザーがありません。",
    },
    actions: {
      openDialog: "パスワード変更",
    },
    dialog: {
      title: "パスワードを変更",
      targetUserLabel: "対象ユーザー：",
      cancel: "キャンセル",
      confirm: "変更",
      confirming: "変更中...",
    },
    fields: {
      newPassword: "新しいパスワード",
      newPasswordConfirm: "新しいパスワード（再入力）",
    },
    helperText: {
      passwordMinHint: "8文字以上を推奨",
      passwordConfirmHint: "確認のため同じパスワードを入力",
    },
    tooltips: {
      show: "表示する",
      hide: "非表示にする",
      ariaShow: "パスワードを表示",
      ariaHide: "パスワードを非表示",
    },
    validation: {
      enterNewPassword: "新しいパスワードを入力してください。",
      passwordMinLength: "パスワードは8文字以上で入力してください。",
      enterConfirmPassword: "確認用パスワードを入力してください。",
      passwordMismatch: "パスワードが一致しません。",
      checkInput: "入力内容を確認してください。",
    },
    snackbar: {
      changed: "パスワードを変更しました。",
      failed: "パスワードの変更に失敗しました。",
    },
  },
};
