create table if not exists public.prefectures (
  prefecture_code text primary key,
  label text not null,
  sort_order integer not null
);

create table if not exists public.cities (
  city_code text primary key,
  prefecture_code text not null references public.prefectures(prefecture_code),
  label text not null,
  sort_order integer not null
);

insert into public.prefectures (prefecture_code, label, sort_order)
values
  ('01', '北海道', 1),
  ('02', '青森県', 2),
  ('03', '岩手県', 3),
  ('04', '宮城県', 4),
  ('05', '秋田県', 5),
  ('06', '山形県', 6),
  ('07', '福島県', 7),
  ('08', '茨城県', 8),
  ('09', '栃木県', 9),
  ('10', '群馬県', 10),
  ('11', '埼玉県', 11),
  ('12', '千葉県', 12),
  ('13', '東京都', 13),
  ('14', '神奈川県', 14),
  ('15', '新潟県', 15),
  ('16', '富山県', 16),
  ('17', '石川県', 17),
  ('18', '福井県', 18),
  ('19', '山梨県', 19),
  ('20', '長野県', 20),
  ('21', '岐阜県', 21),
  ('22', '静岡県', 22),
  ('23', '愛知県', 23),
  ('24', '三重県', 24),
  ('25', '滋賀県', 25),
  ('26', '京都府', 26),
  ('27', '大阪府', 27),
  ('28', '兵庫県', 28),
  ('29', '奈良県', 29),
  ('30', '和歌山県', 30),
  ('31', '鳥取県', 31),
  ('32', '島根県', 32),
  ('33', '岡山県', 33),
  ('34', '広島県', 34),
  ('35', '山口県', 35),
  ('36', '徳島県', 36),
  ('37', '香川県', 37),
  ('38', '愛媛県', 38),
  ('39', '高知県', 39),
  ('40', '福岡県', 40),
  ('41', '佐賀県', 41),
  ('42', '長崎県', 42),
  ('43', '熊本県', 43),
  ('44', '大分県', 44),
  ('45', '宮崎県', 45),
  ('46', '鹿児島県', 46),
  ('47', '沖縄県', 47)
on conflict (prefecture_code) do update
set label = excluded.label,
    sort_order = excluded.sort_order;

insert into public.cities (city_code, prefecture_code, label, sort_order)
values
  ('01100', '01', '札幌市', 1),
  ('02201', '02', '青森市', 1),
  ('03201', '03', '盛岡市', 1),
  ('04100', '04', '仙台市', 1),
  ('05201', '05', '秋田市', 1),
  ('06201', '06', '山形市', 1),
  ('07201', '07', '福島市', 1),
  ('08201', '08', '水戸市', 1),
  ('09201', '09', '宇都宮市', 1),
  ('10201', '10', '前橋市', 1),
  ('11100', '11', 'さいたま市', 1),
  ('12100', '12', '千葉市', 1),
  ('13101', '13', '千代田区', 1),
  ('13102', '13', '中央区', 2),
  ('13103', '13', '港区', 3),
  ('13104', '13', '新宿区', 4),
  ('13113', '13', '渋谷区', 5),
  ('14100', '14', '横浜市', 1),
  ('15100', '15', '新潟市', 1),
  ('16201', '16', '富山市', 1),
  ('17201', '17', '金沢市', 1),
  ('18201', '18', '福井市', 1),
  ('19201', '19', '甲府市', 1),
  ('20201', '20', '長野市', 1),
  ('21201', '21', '岐阜市', 1),
  ('22100', '22', '静岡市', 1),
  ('23100', '23', '名古屋市', 1),
  ('24201', '24', '津市', 1),
  ('25201', '25', '大津市', 1),
  ('26100', '26', '京都市', 1),
  ('27100', '27', '大阪市', 1),
  ('28100', '28', '神戸市', 1),
  ('29201', '29', '奈良市', 1),
  ('30201', '30', '和歌山市', 1),
  ('31201', '31', '鳥取市', 1),
  ('32201', '32', '松江市', 1),
  ('33100', '33', '岡山市', 1),
  ('34100', '34', '広島市', 1),
  ('35203', '35', '山口市', 1),
  ('36201', '36', '徳島市', 1),
  ('37201', '37', '高松市', 1),
  ('38201', '38', '松山市', 1),
  ('39201', '39', '高知市', 1),
  ('40130', '40', '福岡市', 1),
  ('41201', '41', '佐賀市', 1),
  ('42201', '42', '長崎市', 1),
  ('43100', '43', '熊本市', 1),
  ('44201', '44', '大分市', 1),
  ('45201', '45', '宮崎市', 1),
  ('46201', '46', '鹿児島市', 1),
  ('47201', '47', '那覇市', 1)
on conflict (city_code) do update
set prefecture_code = excluded.prefecture_code,
    label = excluded.label,
    sort_order = excluded.sort_order;

alter table public.profiles
drop constraint if exists profiles_prefecture_fkey;

alter table public.profiles
add constraint profiles_prefecture_fkey
foreign key (prefecture)
references public.prefectures(prefecture_code)
not valid;

alter table public.profiles
drop constraint if exists profiles_city_fkey;

alter table public.profiles
add constraint profiles_city_fkey
foreign key (city)
references public.cities(city_code)
not valid;

notify pgrst, 'reload schema';
