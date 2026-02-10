/**
 * GTFS-related constants & helpers.
 *
 * Purpose: keep GTFS-related mappings/labels/options (prefecture, direction, route_type,
 * grouping) centralized so they are not scattered/hardcoded across components/services.
 */

export const prefectureMap = {
	1: "北海道",
	2: "青森県",
	3: "岩手県",
	4: "宮城県",
	5: "秋田県",
	6: "山形県",
	7: "福島県",
	8: "茨城県",
	9: "栃木県",
	10: "群馬県",
	11: "埼玉県",
	12: "千葉県",
	13: "東京都",
	14: "神奈川県",
	15: "新潟県",
	16: "富山県",
	17: "石川県",
	18: "福井県",
	19: "山梨県",
	20: "長野県",
	21: "岐阜県",
	22: "静岡県",
	23: "愛知県",
	24: "三重県",
	25: "滋賀県",
	26: "京都府",
	27: "大阪府",
	28: "兵庫県",
	29: "奈良県",
	30: "和歌山県",
	31: "鳥取県",
	32: "島根県",
	33: "岡山県",
	34: "広島県",
	35: "山口県",
	36: "徳島県",
	37: "香川県",
	38: "愛媛県",
	39: "高知県",
	40: "福岡県",
	41: "佐賀県",
	42: "長崎県",
	43: "熊本県",
	44: "大分県",
	45: "宮崎県",
	46: "鹿児島県",
	47: "沖縄県",
};

export const directionMap = {
	inbound: "1:往路",
	outbound: "0:復路",
	1: "1:往路",
	0: "0:復路",
};

export const groupingMethodMap = {
	GROUPING_BY_NAME: "stop_name",
	GROUPING_BY_ID: "stop_id",
};

export const groupingMethodOptions = [
	{ value: groupingMethodMap.GROUPING_BY_NAME, label: "停留所名称" },
	{ value: groupingMethodMap.GROUPING_BY_ID, label: "停留所ID" },
];

export const directionMapforTimeTable = {
	inbound: "往路",
	outbound: "復路",
	1: "往路",
	0: "復路",
};
// GTFS route_type number + label (JP) for display
export const routeTypeLabel = {
	0: "0: \u8def\u9762\u96fb\u8eca",
	1: "1: \u5730\u4e0b\u9244",
	2: "2: \u9244\u9053",
	3: "3: \u30d0\u30b9",
	4: "4: \u30d5\u30a7\u30ea\u30fc",
	12: "12: \u30e2\u30ce\u30ec\u30fc\u30eb",
};


export const formatRouteType = (value) => {
	const key = Number(value);
	if (Number.isFinite(key) && Object.prototype.hasOwnProperty.call(routeTypeLabel, key)) {
		return routeTypeLabel[key];
	}
	return value ?? "-";
};

export const routeTypeOptions = Object.entries(routeTypeLabel).map(([value, label]) => ({
	value: String(value),
	label,
}));

export const GTFS_DEFAULT_EXPORT_FILES = [
	"agency.txt",
	"stops.txt",
	"routes.txt",
	"trips.txt",
	"stop_times.txt",
	"calendar.txt",
	"calendar_dates.txt",
	"fare_attributes.txt",
	"fare_rules.txt",
	"shapes.txt",
	"translations.txt",
	"feed_info.txt",
];

export const GTFS_DEFAULT_TABLE_NAMES = [
	"agency",
	"stops",
	"routes",
	"trips",
	"stop_times",
	"calendar",
	"calendar_dates",
	"fare_attributes",
	"fare_rules",
	"shapes",
	"translations",
	"feed_info",
];

export const GTFS_STORAGE_KEYS = {
	selectedScenarioVisualization: "selected-scenario-visualization",
};
