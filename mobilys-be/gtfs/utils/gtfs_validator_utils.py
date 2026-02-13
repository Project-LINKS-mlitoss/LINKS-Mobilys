# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
# constants/gtfs_validation.py

GTFS_NOTICE_TITLES = {
    # ERRORS
    "foreign_key_violation": {"en": "Foreign Key Violation", "ja": "外部キー違反"},
    "missing_required_field": {"en": "Missing Required Field", "ja": "必須フィールドの欠落"},
    "missing_required_file": {"en": "Missing Required File", "ja": "必須ファイルの欠落"},
    "duplicate_key": {"en": "Duplicate Key", "ja": "重複キー"},
    "invalid_row_length": {"en": "Invalid Row Length", "ja": "行の長さが不正"},
    "invalid_url": {"en": "Invalid URL", "ja": "無効なURL"},
    "invalid_email": {"en": "Invalid Email", "ja": "無効なメールアドレス"},
    "invalid_date": {"en": "Invalid Date", "ja": "無効な日付"},
    "invalid_time": {"en": "Invalid Time", "ja": "無効な時刻"},
    "invalid_float": {"en": "Invalid Decimal Number", "ja": "無効な小数"},
    "invalid_integer": {"en": "Invalid Integer", "ja": "無効な整数"},
    "invalid_color": {"en": "Invalid Color", "ja": "無効な色"},
    "invalid_timezone": {"en": "Invalid Timezone", "ja": "無効なタイムゾーン"},
    "invalid_language_code": {"en": "Invalid Language Code", "ja": "無効な言語コード"},
    "invalid_currency": {"en": "Invalid Currency Code", "ja": "無効な通貨コード"},
    "number_out_of_range": {"en": "Number Out of Range", "ja": "数値が範囲外"},
    "empty_file": {"en": "Empty File", "ja": "空のファイル"},
    "trip_distance_exceeds_shape_distance": {"en": "Trip Distance Exceeds Shape Distance", "ja": "トリップ距離がシェイプ距離を超える"},
    "stop_time_with_arrival_before_previous_departure": {"en": "Arrival Before Previous Departure", "ja": "前の出発時刻より前に到着"},
    "stop_time_with_arrival_before_previous_departure_time": {"en": "Arrival Before Previous Departure Time", "ja": "前の出発時刻より前に到着"},
    "stop_time_timepoint_without_times": {"en": "Timepoint Without Times", "ja": "timepointなのに到着/出発時刻がない"},
    "stop_time_with_only_arrival_or_departure_time": {"en": "Missing Arrival or Departure Time", "ja": "到着時刻または出発時刻の欠落"},
    "decreasing_shape_distance": {"en": "Decreasing Shape Distance", "ja": "シェイプ距離の減少"},
    "decreasing_stop_time_distance": {"en": "Decreasing Stop Time Distance", "ja": "停車時刻距離の減少"},
    "overlapping_frequency": {"en": "Overlapping Frequency", "ja": "頻度の重複"},
    "block_trips_with_overlapping_stop_times": {"en": "Block Trips Overlap", "ja": "ブロックトリップの重複"},
    "wrong_parent_location_type": {"en": "Wrong Parent Location Type", "ja": "親ロケーションタイプが不正"},
    "station_with_parent_station": {"en": "Station With Parent Station", "ja": "駅に親駅が設定されている"},
    "location_without_parent_station": {"en": "Location Without Parent Station", "ja": "親駅のないロケーション"},
    "route_color_contrast": {"en": "Insufficient Color Contrast", "ja": "色のコントラスト不足"},
    "trip_without_stop_time": {"en": "Trip Without Stop Times", "ja": "停車時刻のないトリップ"},
    "missing_trip_edge": {"en": "Missing Trip Edge", "ja": "トリップの始点/終点の時刻が欠落"},
    "stop_without_location": {"en": "Stop Without Location", "ja": "位置情報のない停留所"},
    "translation_foreign_key_violation": {"en": "Translation Foreign Key Violation", "ja": "translations.txt の外部キー違反"},
    "missing_calendar_and_calendar_date_files": {"en": "Missing Calendar Files", "ja": "calendar.txt と calendar_dates.txt がない"},
    
    
    # WARNINGS
    "unknown_column": {"en": "Unknown Column", "ja": "不明な列"},
    "unknown_file": {"en": "Unknown File", "ja": "不明なファイル"},
    "empty_column_name": {"en": "Empty Column Name", "ja": "空の列名"},
    "duplicate_route_name": {"en": "Duplicate Route Name", "ja": "重複した路線名"},
    "fast_travel_between_stops": {"en": "Unrealistic Travel Speed", "ja": "非現実的な移動速度"},
    "fast_travel_between_far_stops": {"en": "Unrealistic Travel Speed (Far Stops)", "ja": "非現実的な移動速度（遠距離）"},
    "fast_travel_between_consecutive_stops": {"en": "Unrealistic Travel Speed (Consecutive)", "ja": "非現実的な移動速度（連続停留所）"},
    "stop_too_far_from_trip_shape": {"en": "Stop Far From Shape", "ja": "停留所がシェイプから離れている"},
    "stops_too_close": {"en": "Stops Too Close", "ja": "停留所が近すぎる"},
    "stop_without_stop_time": {"en": "Unused Stop", "ja": "未使用の停留所"},
    "route_without_agency": {"en": "Route Without Agency", "ja": "事業者のない路線"},
    "start_and_end_date_out_of_order": {"en": "Date Range Invalid", "ja": "日付範囲が無効"},
    "feed_expiration_date": {"en": "Feed Expiring Soon", "ja": "フィードの有効期限が近い"},
    "expired_feed": {"en": "Feed Expired", "ja": "フィードの有効期限切れ"},
    "route_short_name_too_long": {"en": "Route Short Name Too Long", "ja": "路線短縮名が長すぎる"},
    "route_long_name_equals_short_name": {"en": "Route Names Identical", "ja": "路線名が同一"},
    "route_long_name_contains_short_name": {"en": "Long Name Contains Short Name", "ja": "正式名に短縮名が含まれる"},
    "same_name_and_description_for_route": {"en": "Route Name Equals Description", "ja": "路線名と説明が同一"},
    "same_name_and_description_for_stop": {"en": "Stop Name Equals Description", "ja": "停留所名と説明が同一"},
    "unused_shape": {"en": "Unused Shape", "ja": "未使用のシェイプ"},
    "missing_trip_edge_arrival_departure": {"en": "Missing Edge Stop Time", "ja": "端の停車時刻が欠落"},
    
    # INFO
    "leading_or_trailing_whitespace": {"en": "Whitespace in Value", "ja": "値に空白がある"},
    "non_ascii_or_non_printable_char": {"en": "Non-Standard Character", "ja": "非標準文字"},
    "feed_info_lang_and_agency_lang_mismatch": {"en": "Language Mismatch", "ja": "言語の不一致"},
}


def get_notice_metadata(code: str, lang: str = "ja") -> dict:
    """Get title for a notice code."""
    titles = GTFS_NOTICE_TITLES.get(code)
    
    if not titles:
        # Fallback: convert code to readable title
        return {"title": code.replace("_", " ").title()}
    
    return {"title": titles.get(lang, titles.get("en", code))}
