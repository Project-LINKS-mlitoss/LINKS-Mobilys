JP = {
    "KEY": "交通調査基本区間番号",
    "ROAD": "路線名",
    "LEN": "区間延長（ｋｍ）",
    "UP12": "上り／昼間１２時間自動車類交通量／合計（台）",
    "DN12": "下り／昼間１２時間自動車類交通量／合計（台）",
    "UP24": "上り／２４時間自動車類交通量／合計（台）",
    "DN24": "下り／２４時間自動車類交通量／合計（台）",
    "SPDUP": "昼間１２時間平均旅行速度（時間帯別交通量加重）／上り（ｋｍ／ｈ）",
    "SPDDN": "昼間１２時間平均旅行速度（時間帯別交通量加重）／下り（ｋｍ／ｈ）",
    "LANE": "車線数",
    "SIG": "交差点密度／信号交差点（箇所／ｋｍ）",
    "CONG": "混雑度",
}


SHP_LINKS_RAW_MAPPING = {
    "survey_unit": "調査単位",
    "matchcode": "MATCHCODE",
    "link_cd": "リンクCD",
    "link_len": "リンク長",
    "lanes_cd": "車線CD",
    "speed_code": "規制速度",
    "access_cd": "通行CD",
    "toll_cd": "有料CD",
    "motor_only_cd": "自専CD",
    "updown_cd": "管上下CD",
    "traffic12": "交通量12",
    "travel_speed_dkmh": "旅行速度",
    "w12h": "W12h交",
    "w24h": "W24h交",
    "h12h": "H12h交",
    "h24h": "H24h交",
    "geom": "LINESTRING",
}


SHAPEFILE_ENCODING_CANDIDATES = ("cp932", "shift_jis", "utf-8", "euc-jp", "latin1")

