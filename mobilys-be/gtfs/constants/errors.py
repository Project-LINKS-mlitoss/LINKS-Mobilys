# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
"""GTFS app error messages.

Centralizes user-facing error strings used across GTFS services/views.
"""


class ErrorMessages:
    # General / Common
    AUTHENTICATION_REQUIRED_JA = "認証が必要です。"
    PERMISSION_DENIED_PROJECT_JA = "このプロジェクトにアクセスする権限がありません。"
    SYSTEM_ERROR_RETRY_JA = "システムエラーが発生しました。もう一度お試しください。"
    INVALID_REQUEST_DATA_JA = "リクエストデータに不備があります。"

    SCENARIO_ID_REQUIRED_JA = "シナリオIDが必要です"
    SCENARIO_ID_REQUIRED_JA_DOT = "シナリオIDが必要です。"
    SCENARIO_ID_REQUIRED_EN = "scenario_id is required"

    SCENARIO_NOT_FOUND_JA = "シナリオが見つかりません"
    SCENARIO_NOT_FOUND_JA_DOT = "シナリオが見つかりません。"
    SCENARIO_REQUIRED_JA = "シナリオが必要です"
    SPECIFIED_SCENARIO_NOT_FOUND_JA = "指定されたシナリオが存在しません。"

    NOT_FOUND_EN_DOT = "Not found."

    # GTFS Validation (API)
    VALIDATION_SERVICE_UNAVAILABLE_EN = "Validation service unavailable"
    INVALID_VALIDATION_SERVICE_RESPONSE_EN = "Invalid response from validation service"
    NO_VALIDATION_RESULT_FOUND_EN = "No validation result found. Run validation first."
    DATABASE_ERROR_OCCURRED_EN = "Database error occurred"
    UNEXPECTED_ERROR_OCCURRED_EN = "An unexpected error occurred"

    # Scenario
    START_DATE_AFTER_END_DATE_JA = "開始日が終了日より後になっています。"
    GTFS_VALIDATION_ERROR_JA = "GTFSバリデーションエラーが発生しました。"
    SCENARIO_NAME_ALREADY_EXISTS_JA = "シナリオ名が既に存在します。"
    SCENARIO_NAME_ALREADY_EXISTS_VARIANT_JA = "シナリオ名が既に存在されました。"
    SCENARIO_CREATE_INTERNAL_ERROR_JA = "シナリオの作成中に内部エラーが発生しました。"
    GTFS_IMPORT_FAILED_JA = "GTFSインポートに失敗しました。"
    GTFS_IMPORT_INTERNAL_ERROR_JA = "GTFSインポート中に内部エラーが発生しました。"
    SCENARIO_BUILD_IN_PROGRESS_DELETE_BLOCKED_JA = "シナリオはまだビルド中です。ビルドが完了するまで削除できません。"
    SCENARIO_DELETE_ERROR_JA = "シナリオの削除中にエラーが発生しました。"
    INVALID_UPDATE_CONTENT_JA = "更新内容に不備があります。"
    PROJECT_FETCH_FAILED_JA = "プロジェクトの取得に失敗しました。"
    FEEDINFO_NOT_FOUND_JA = "FeedInfoが見つかりません"
    SCENARIO_FETCH_ERROR_JA = "シナリオの取得中にエラーが発生しました。"
    SCENARIO_CLONE_ERROR_JA = "クローン作成中にエラーが発生しました。"
    NO_CLONE_CANDIDATES_FEEDINFO_MISSING_JA = "複製候補はありません（feed_info が見つかりません）。"
    GTFS_EXPORT_GENERATION_ERROR_JA = "GTFSエクスポートの生成中にエラーが発生しました。"
    GTFS_DATA_FETCH_ERROR_JA = "GTFSデータの取得中にエラーが発生しました。"
    INVALID_FILE_FORMAT_ZIP_ONLY_JA = "ファイル形式が無効です。ZIPファイルのみアップロードできます。"

    # Calendar
    TRIPS_NOT_FOUND_JA = "運行が見つかりません"
    DATABASE_ERROR_JA = "データベースエラーが発生しました"
    UNEXPECTED_ERROR_JA = "予期しないエラーが発生しました"
    UNEXPECTED_ERROR_JA_DOT = "予期しないエラーが発生しました。"
    CALENDAR_LIST_FETCH_ERROR_JA = "カレンダーリストの取得中にエラーが発生しました"

    # Map
    MAP_ID_REQUIRED_JA = "map_idが必要です。"
    MAP_NOT_FOUND_MESSAGE_JA = "地図が見つかりません。"
    MAP_NOT_FOUND_ERROR_JA = "地図が見つかなかった。"
    MAP_UPDATE_FAILED_MESSAGE_TEMPLATE_JA = "地図の更新に失敗しました: {error}"
    MAP_UPDATE_FAILED_ERROR_JA = "地図の更新に失敗しました。"

    # Notifications
    NOTIFICATIONS_FETCH_FAILED_JA = "お知らせの取得に失敗しました。"
    NOTIFICATION_CREATE_FAILED_JA = "お知らせの作成に失敗しました。"
    NOTIFICATION_ID_REQUIRED_EN = "notification_id is required."
    NOTIFICATION_NOT_FOUND_JA = "お知らせが見つかりません。"
    NOTIFICATION_UPDATE_FAILED_JA = "お知らせの更新に失敗しました。"
    NOTIFICATIONS_MARK_ALL_READ_FAILED_JA = "お知らせをすべて既読にするのに失敗しました。"

    # Route Patterns
    ROUTE_DATA_REQUIRED_JA = "シナリオID、ルートデータ、トリップデータ、およびストップシーケンスは必須です。"
    ROUTE_DATA_MUST_BE_DICT_JA = "ルートデータとトリップデータは辞書形式である必要があります。"
    INVALID_DATA_FORMAT_JA = "無効なデータ形式です。"
    ROUTE_ID_REQUIRED_JA = "ルートIDは必須です。"
    DATA_INTEGRITY_ERROR_JA = "データの整合性エラーが発生しました。"
    SCENARIO_ID_REQUIRED_VARIANT_JA = "シナリオIDは必須です。"
    ROUTE_PATTERN_REQUIRED_JA = "ルートパターンは必須です。"
    ROUTE_ID_REQUIRED_MESSAGE_JA = "ルートIDが必要です。"
    DIRECTION_ID_REQUIRED_JA = "方向IDが必要です。"
    SERVICE_ID_REQUIRED_JA = "サービスIDが必要です。"
    SHAPE_ID_REQUIRED_JA = "シェイプIDが必要です。"
    INVALID_OR_MISSING_NEW_STOP_SEQUENCE_EN = "Invalid or missing new_stop_sequence"
    ROUTE_EXISTING_PATTERN_REQUIRED_JA = "シナリオID、ルートID、トリップデータ、およびストップシーケンスは必須です。"
    SPECIFIED_ROUTE_NOT_FOUND_JA = "指定されたルートが存在しません。"
    ROUTE_PATTERN_DUPLICATE_JA = "ルートパターンが重複しています。"
    ROUTE_PATTERN_CREATE_ERROR_JA = "ルートパターンの作成中にエラーが発生しました。"
    ROUTE_PATTERN_DELETE_ERROR_JA = "ルートパターンの削除中にエラーが発生しました。"
    ROUTE_PATTERN_UPDATE_ERROR_JA = "ルートパターンの更新中にエラーが発生しました。"
    EXISTING_ROUTE_PATTERN_CREATE_ERROR_JA = "既存のルートパターンの作成中にエラーが発生しました。"

    # Routes
    ROUTE_GROUP_FETCH_FAILED_JA = "ルートグループデータの取得に失敗しました。"
    ROUTE_PATTERN_BUILD_FAILED_JA = "ルートパターンの構築に失敗しました。"
    ROUTE_KEYWORDS_FETCH_FAILED_JA = "ルートキーワードの取得に失敗しました。"
    ROUTE_KEYWORD_MAPPING_FETCH_FAILED_JA = "ルートキーワードマッピングの取得に失敗しました。"
    STOP_GROUP_GEOJSON_BUILD_FAILED_JA = "ストップグループGeoJSONの構築に失敗しました。"
    ROUTE_GROUP_UPDATE_FAILED_JA = "ルートグループデータの更新中にエラーが発生しました。"
    ROUTE_KEYWORD_COLOR_UPDATE_FAILED_JA = "ルートキーワードの色の更新に失敗しました。"
    SCENARIO_ID_AND_KEYWORD_REQUIRED_JA = "scenario_id と keyword は必須です。"
    ROUTE_GROUP_NAME_IN_USE_JA = "この路線グループ名は使用されています。別の名称を入力してください。"
    ROUTE_GROUP_CREATE_FAILED_JA = "路線グループの作成に失敗しました。"
    ROUTE_GROUP_REQUIRED_JA = "路線グループは必須です。"
    ID_REQUIRED_JA = "IDは必須です。"
    GROUP_NAME_REQUIRED_JA = "グループ名は必須です。"
    ROUTE_GROUP_NOT_FOUND_JA = "指定された路線グループが見つかりません。"
    ROUTE_GROUP_DUPLICATE_NAME_JA = "同じ名前のグループが既に存在します。"
    ROUTE_GROUP_NAME_UPDATE_FAILED_JA = "路線グループ名の更新に失敗しました。"

    # Trips
    TRIP_ID_REQUIRED_JA = "trip_idが必要です"
    TRIP_ID_ALREADY_EXISTS_TEMPLATE_JA = "trip_id「{trip_id}」は既に存在します。"
    ROUTE_ID_REQUIRED_FOR_TRIP_JA = "route_idが必要です"
    ROUTE_ID_NOT_FOUND_TEMPLATE_JA = "route_id「{route_id}」は存在しません。"
    DUPLICATE_TRIP_JA = "同じトリップが既に存在します"
    TRIP_NOT_FOUND_JA = "トリップが見つかりません"
    ROUTE_NOT_FOUND_JA = "ルートが見つかりません"
    SCENARIO_ID_AND_STOP_ID_REQUIRED_JA = "シナリオIDと停止IDが必要です"
    SCENARIO_ID_AND_TRIP_ID_REQUIRED_JA = "scenario_idとtrip_idが必要です"
    TRIP_UPDATE_FAILED_JA = "トリップの更新に失敗しました"
    TRIP_IDS_REQUIRED_FOR_DELETE_JA = "削除するtrip_idのリストが必要です"

    # Stops
    INVALID_STOP_GROUPING_METHOD_JA = "stop_grouping_methodの値が無効です。"
    INVALID_GROUPING_METHOD_JA = "grouping_methodの値が無効です。"
    SCENARIO_UPDATE_ERROR_JA = "シナリオの更新中にエラーが発生しました。"
    SCENARIO_UPDATE_ERROR_TEMPLATE_JA = "シナリオの更新中にエラーが発生しました: {error}"
    STOP_REQUIRED_FIELDS_JA = "scenario_id、stop_id、stop_name、stop_lat、stop_lonは必須です。"
    STOP_ID_ALREADY_EXISTS_TEMPLATE_JA = "stop_id「{stop_id}」のStopは既に存在します。"
    PARENT_STOP_GROUP_INFO_NOT_FOUND_JA = "親の停留所にグループ情報が見つかりません。"
    ERROR_OCCURRED_TEMPLATE_JA = "エラーが発生しました: {error}"
    STOP_LAT_LON_REQUIRED_JA = "stop_latとstop_lonは必須です。"
    STOP_NOT_FOUND_JA = "Stopが見つかりません。"
    SCENARIO_ID_AND_STOP_ID_REQUIRED_VARIANT_JA = "scenario_idとstop_idは必須です。"
    SCENARIO_ID_REQUIRED_JA_PERIOD = "scenario_idは必須です。"
    REQUIRED_FIELDS_MISSING_TEMPLATE_JA = "必須フィールドが不足しています: {fields}"
    STOP_NAME_KEYWORDS_NOT_FOUND_JA = "StopNameKeywordsが見つかりません。"
    STOP_ID_KEYWORD_NOT_FOUND_JA = "StopIdKeywordが見つかりません。"
    CALENDAR_NOT_FOUND_JA = "カレンダーが見つかりません"
    STOP_NAME_KEYWORDS_ALREADY_EXISTS_TEMPLATE_JA = "StopNameKeywords「{stop_name}」は既に存在します。"
    STOP_ID_KEYWORD_ALREADY_EXISTS_TEMPLATE_JA = "StopIdKeyword「{prefix}」は既に存在します。"

    # Shapes
    SCENARIO_ID_NOT_PROVIDED_JA = "シナリオIDが提供されていません。"
    INVALID_PAYLOAD_EN = "Invalid payload"
    SHAPE_GENERATION_FAILED_EN = "Failed to generate shape"
    SCENARIO_ID_MISMATCH_EN = "scenario_id mismatch"
    SCENARIO_ID_REQUIRED_EN_LOWER = "scenario_id is required"
    SCENARIO_ID_REQUIRED_PATH_OR_BODY_EN = "scenario_id is required (path or body)."
    SCENARIO_NOT_FOUND_EN = "Scenario not found"
    SHAPE_PT_LAT_LON_REQUIRED_FOR_PUT_EN = "shape_pt_lat and shape_pt_lon are required for PUT"
    SOME_SHAPE_POINTS_DO_NOT_EXIST_EN = "Some shape points do not exist (set upsert=true to create)."
    SHAPE_PT_LAT_LON_REQUIRED_TO_UPSERT_EN = "shape_pt_lat and shape_pt_lon are required to upsert new points."
    AT_LEAST_ONE_TRIP_ROUTE_OR_ALLDATA_REQUIRED_JA = "少なくとも1つのtrip_id、route_id、またはisAllDataを指定する必要があります。"

    # Trip Frequency
    SCENARIO_ID_REQUIRED_FOR_TRIP_FREQUENCY_JA = "scenario_idが必要です。"
    EMPTY_PAYLOAD_EN = "empty payload"

    # OneDetailed (Ridership detail converters)
    RIDERSHIP_SCENARIO_NOT_FOUND_EN = "Scenario not found"
    FAILED_TO_READ_FILE_TEMPLATE_EN = "Failed to read file: {error}"
    RIDERSHIP_UPLOAD_ID_REQUIRED_WHEN_NO_FILE_EN = "ridership_upload_id is required when file is not provided"
    RIDERSHIP_UPLOAD_NOT_FOUND_EN = "RidershipUpload not found"
    NO_RIDERSHIP_RECORDS_FOR_UPLOAD_EN = "No ridership records found for this upload"

    # GTFS Scenario Validator
    MISSING_REQUIRED_GTFS_FILES_JA = "必要なGTFSファイルが不足しています。"
    INVALID_ZIP_FILE_JA = "無効なZIPファイルです。"
    VALIDATION_PROCESSING_ERROR_JA = "バリデーション処理中にエラーが発生しました。"
    GTFS_FILE_ROW_ERROR_TEMPLATE_JA = "{filename} の行 {idx} でエラーが発生しました。"

    # Views (GTFS Safe Notices)
    INVALID_IS_ACTIVE_VALUE_EN = "Invalid is_active value. Use true/false."
    VALIDATION_FAILED_EN = "Validation failed"

    # Views (Routes)
    GROUP_CHANGES_MUST_BE_LIST_JA = "group_changesはリストでなければなりません。"

    # Ridership upload/export (service messages often mirrored into payloads)
    RIDERSHIP_UPLOAD_NOT_FOUND_JA = "アップロードが見つかりません"
    RIDERSHIP_EXPORT_NO_RECORDS_JA = "エクスポートするレコードがありません"
    RIDERSHIP_EXPORT_LIMIT_EXCEEDED_JA = "エクスポート上限を超えています"
