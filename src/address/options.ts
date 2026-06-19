export type AddressOption = {
  code: string
  label: string
}

export const prefecture_options: AddressOption[] = [
  { code: "01", label: "北海道" },
  { code: "02", label: "青森県" },
  { code: "03", label: "岩手県" },
  { code: "04", label: "宮城県" },
  { code: "05", label: "秋田県" },
  { code: "06", label: "山形県" },
  { code: "07", label: "福島県" },
  { code: "08", label: "茨城県" },
  { code: "09", label: "栃木県" },
  { code: "10", label: "群馬県" },
  { code: "11", label: "埼玉県" },
  { code: "12", label: "千葉県" },
  { code: "13", label: "東京都" },
  { code: "14", label: "神奈川県" },
  { code: "15", label: "新潟県" },
  { code: "16", label: "富山県" },
  { code: "17", label: "石川県" },
  { code: "18", label: "福井県" },
  { code: "19", label: "山梨県" },
  { code: "20", label: "長野県" },
  { code: "21", label: "岐阜県" },
  { code: "22", label: "静岡県" },
  { code: "23", label: "愛知県" },
  { code: "24", label: "三重県" },
  { code: "25", label: "滋賀県" },
  { code: "26", label: "京都府" },
  { code: "27", label: "大阪府" },
  { code: "28", label: "兵庫県" },
  { code: "29", label: "奈良県" },
  { code: "30", label: "和歌山県" },
  { code: "31", label: "鳥取県" },
  { code: "32", label: "島根県" },
  { code: "33", label: "岡山県" },
  { code: "34", label: "広島県" },
  { code: "35", label: "山口県" },
  { code: "36", label: "徳島県" },
  { code: "37", label: "香川県" },
  { code: "38", label: "愛媛県" },
  { code: "39", label: "高知県" },
  { code: "40", label: "福岡県" },
  { code: "41", label: "佐賀県" },
  { code: "42", label: "長崎県" },
  { code: "43", label: "熊本県" },
  { code: "44", label: "大分県" },
  { code: "45", label: "宮崎県" },
  { code: "46", label: "鹿児島県" },
  { code: "47", label: "沖縄県" },
]

export const city_options_by_prefecture: Record<string, AddressOption[]> = {
  "01": [{ code: "01100", label: "札幌市" }],
  "02": [{ code: "02201", label: "青森市" }],
  "03": [{ code: "03201", label: "盛岡市" }],
  "04": [{ code: "04100", label: "仙台市" }],
  "05": [{ code: "05201", label: "秋田市" }],
  "06": [{ code: "06201", label: "山形市" }],
  "07": [{ code: "07201", label: "福島市" }],
  "08": [{ code: "08201", label: "水戸市" }],
  "09": [{ code: "09201", label: "宇都宮市" }],
  "10": [{ code: "10201", label: "前橋市" }],
  "11": [{ code: "11100", label: "さいたま市" }],
  "12": [{ code: "12100", label: "千葉市" }],
  "13": [
    { code: "13101", label: "千代田区" },
    { code: "13102", label: "中央区" },
    { code: "13103", label: "港区" },
    { code: "13104", label: "新宿区" },
    { code: "13113", label: "渋谷区" },
  ],
  "14": [{ code: "14100", label: "横浜市" }],
  "15": [{ code: "15100", label: "新潟市" }],
  "16": [{ code: "16201", label: "富山市" }],
  "17": [{ code: "17201", label: "金沢市" }],
  "18": [{ code: "18201", label: "福井市" }],
  "19": [{ code: "19201", label: "甲府市" }],
  "20": [{ code: "20201", label: "長野市" }],
  "21": [{ code: "21201", label: "岐阜市" }],
  "22": [{ code: "22100", label: "静岡市" }],
  "23": [{ code: "23100", label: "名古屋市" }],
  "24": [{ code: "24201", label: "津市" }],
  "25": [{ code: "25201", label: "大津市" }],
  "26": [{ code: "26100", label: "京都市" }],
  "27": [{ code: "27100", label: "大阪市" }],
  "28": [{ code: "28100", label: "神戸市" }],
  "29": [{ code: "29201", label: "奈良市" }],
  "30": [{ code: "30201", label: "和歌山市" }],
  "31": [{ code: "31201", label: "鳥取市" }],
  "32": [{ code: "32201", label: "松江市" }],
  "33": [{ code: "33100", label: "岡山市" }],
  "34": [{ code: "34100", label: "広島市" }],
  "35": [{ code: "35203", label: "山口市" }],
  "36": [{ code: "36201", label: "徳島市" }],
  "37": [{ code: "37201", label: "高松市" }],
  "38": [{ code: "38201", label: "松山市" }],
  "39": [{ code: "39201", label: "高知市" }],
  "40": [{ code: "40130", label: "福岡市" }],
  "41": [{ code: "41201", label: "佐賀市" }],
  "42": [{ code: "42201", label: "長崎市" }],
  "43": [{ code: "43100", label: "熊本市" }],
  "44": [{ code: "44201", label: "大分市" }],
  "45": [{ code: "45201", label: "宮崎市" }],
  "46": [{ code: "46201", label: "鹿児島市" }],
  "47": [{ code: "47201", label: "那覇市" }],
}

export function get_city_options(prefecture_code: string | null | undefined) {
  if (!prefecture_code) {
    return []
  }

  return city_options_by_prefecture[prefecture_code] ?? []
}

export function is_prefecture_code(value: string | null | undefined) {
  return prefecture_options.some((option) => option.code === value)
}

export function is_city_code(
  prefecture_code: string | null | undefined,
  city_code: string | null | undefined,
) {
  if (!city_code) {
    return true
  }

  return get_city_options(prefecture_code).some(
    (option) => option.code === city_code,
  )
}
