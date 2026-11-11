// 馬・レースのマスターデータ

// 枠色（1〜7番）
export const FRAMES = [
  { bg: '#f4f4f4', fg: '#111111', sleeve: '#d92b2b', label: '白' },
  { bg: '#1b1b1b', fg: '#ffffff', sleeve: '#f2c81d', label: '黒' },
  { bg: '#e0282e', fg: '#ffffff', sleeve: '#ffffff', label: '赤' },
  { bg: '#1b63d6', fg: '#ffffff', sleeve: '#ffffff', label: '青' },
  { bg: '#f6d21a', fg: '#111111', sleeve: '#1b1b1b', label: '黄' },
  { bg: '#1f9d42', fg: '#ffffff', sleeve: '#f6d21a', label: '緑' },
  { bg: '#f48a1c', fg: '#111111', sleeve: '#22306e', label: '橙' },
];

export const STYLES = {
  nige: { label: '逃げ', short: '逃' },
  senko: { label: '先行', short: '先' },
  sashi: { label: '差し', short: '差' },
  oikomi: { label: '追込', short: '追' },
};

export const FORMS = [
  { key: 'best', label: '絶好調', icon: '⬆', delta: 3, w: 15 },
  { key: 'good', label: '好調', icon: '↗', delta: 1.5, w: 30 },
  { key: 'normal', label: '普通', icon: '➡', delta: 0, w: 35 },
  { key: 'bad', label: '不調', icon: '↘', delta: -2.5, w: 20 },
];

// [名前, 強さ, 脚質, 毛色, キャッチ, 大逃げ?]
const L = [
  ['ディープインパクト', 100, 'oikomi', 'bay', '英雄。空を飛ぶ末脚'],
  ['イクイノックス', 100, 'senko', 'black', '世界No.1の天才'],
  ['シンボリルドルフ', 99, 'senko', 'bay', '皇帝。無敗の三冠'],
  ['アーモンドアイ', 99, 'sashi', 'bay', '九冠の女王'],
  ['オルフェーヴル', 98, 'sashi', 'chestnut', '金色の暴君'],
  ['ナリタブライアン', 98, 'sashi', 'darkbay', 'シャドーロールの怪物'],
  ['サイレンススズカ', 97, 'nige', 'chestnut', '異次元の逃亡者', true],
  ['テイエムオペラオー', 97, 'senko', 'chestnut', '世紀末覇王'],
  ['キタサンブラック', 97, 'nige', 'bay', 'みんなの愛馬'],
  ['エルコンドルパサー', 97, 'senko', 'darkbay', '世界を驚かせた怪鳥'],
  ['コントレイル', 96, 'sashi', 'black', '無敗の三冠馬'],
  ['ジェンティルドンナ', 96, 'senko', 'bay', '貴婦人'],
  ['オグリキャップ', 96, 'sashi', 'grey', '芦毛の怪物'],
  ['ロードカナロア', 96, 'senko', 'bay', '世界の短距離王'],
  ['トウカイテイオー', 95, 'senko', 'bay', '不屈の帝王'],
  ['ウオッカ', 95, 'sashi', 'bay', 'ダービーを制した女傑'],
  ['ダイワスカーレット', 95, 'nige', 'chestnut', '緋色の女王'],
  ['スペシャルウィーク', 95, 'sashi', 'darkbay', '日本総大将'],
  ['グラスワンダー', 95, 'sashi', 'chestnut', '栗毛の怪物'],
  ['メジロマックイーン', 95, 'senko', 'grey', '名優'],
  ['マルゼンスキー', 95, 'nige', 'bay', 'スーパーカー'],
  ['ドウデュース', 95, 'oikomi', 'bay', '切れ味鋭い豪脚'],
  ['ゴールドシップ', 94, 'oikomi', 'grey', '気まぐれな不沈艦'],
  ['タマモクロス', 94, 'oikomi', 'grey', '白い稲妻'],
  ['ブエナビスタ', 94, 'oikomi', 'darkbay', '絶景の末脚'],
  ['クロノジェネシス', 94, 'senko', 'grey', 'グランプリ女王'],
  ['アグネスタキオン', 94, 'senko', 'chestnut', '超光速の粒子'],
  ['ミホノブルボン', 93, 'nige', 'chestnut', '坂路の申し子'],
  ['ビワハヤヒデ', 93, 'senko', 'grey', '安定感の塊'],
  ['ライスシャワー', 92, 'senko', 'darkbay', '漆黒のステイヤー'],
  ['ハイセイコー', 92, 'senko', 'bay', '元祖アイドルホース'],
  ['エアグルーヴ', 92, 'senko', 'bay', '女帝'],
  ['ヒシアマゾン', 91, 'oikomi', 'darkbay', '豪快な追い込み'],
  ['マヤノトップガン', 91, 'sashi', 'chestnut', '変幻自在'],
  ['サクラバクシンオー', 91, 'nige', 'bay', '驀進王'],
  ['ステイゴールド', 90, 'sashi', 'darkbay', '愛さずにいられない'],
  ['セイウンスカイ', 90, 'nige', 'grey', '芦毛のトリックスター'],
  ['メイショウドトウ', 89, 'senko', 'bay', '不屈の善戦マン'],
  ['ウイニングチケット', 89, 'sashi', 'darkbay', 'ダービーに懸けた馬'],
  ['キングヘイロー', 88, 'oikomi', 'bay', '諦めない良血'],
  ['パンサラッサ', 88, 'nige', 'bay', '世界を逃げ切った', true],
  ['メジロライアン', 88, 'sashi', 'bay', '愛すべき大器'],
  ['マチカネフクキタル', 87, 'sashi', 'chestnut', '福を呼ぶ末脚'],
  ['ナイスネイチャ', 86, 'sashi', 'bay', 'ブロンズコレクター'],
  ['メジロパーマー', 86, 'nige', 'bay', '逃げて逃げて逃げまくる'],
  ['ダイタクヘリオス', 86, 'nige', 'darkbay', '笑う逃亡者'],
  ['ツインターボ', 84, 'nige', 'bay', '逆噴射上等の大逃げ', true],
  ['イクノディクタス', 84, 'senko', 'chestnut', '鉄の女'],
  ['ハルウララ', 72, 'oikomi', 'bay', '負けても愛される'],
];

export const LEGENDS = L.map((r, i) => ({
  id: 'L' + i, name: r[0], rating: r[1], style: r[2], coat: r[3], catch: r[4], bigNige: !!r[5],
}));

// リクエストの特別出走馬（強さ・脚質は毎レース気まぐれ）
export const FRIENDS = ['カミノ', 'イイダタツヤ', 'サトフカ', 'イッシキ'].map((name, i) => ({
  id: 'F' + i, name, friend: true,
}));

export const FRIEND_CATCH = [
  '今日こそ主役', '二日酔いでも走る', '酒が入ると強い', '謎の自信あり', '気合だけは世界一',
  '終電より速い', '乾杯の合図で覚醒', '昨日はよく寝た', '本気を出す日が来た', '走る宴会部長',
  'シメのラーメンが原動力', '実は努力家', '打ち上げ目当て', 'ノリと勢い',
];

export const COATS = ['bay', 'darkbay', 'black', 'chestnut', 'grey', 'white'];
export const COAT_LABEL = { bay: '鹿毛', darkbay: '黒鹿毛', black: '青鹿毛', chestnut: '栗毛', grey: '芦毛', white: '白毛' };

export const RACE_TYPES = {
  solo: { label: '1強ムード', desc: '断然の本命が1頭', color: '#e0282e' },
  duo: { label: '2強対決', desc: '2頭の一騎打ち', color: '#1b63d6' },
  trio: { label: '3強激突', desc: '三つ巴の争い', color: '#8a3fd1' },
  normal: { label: '本命やや優勢', desc: '順当か、波乱か', color: '#1f9d42' },
  mixed: { label: '混戦模様', desc: '上位は横一線', color: '#f48a1c' },
  chaos: { label: '大混戦', desc: 'どの馬にもチャンス', color: '#c2185b' },
  dream: { label: 'ドリームレース', desc: '歴代最強馬が勢ぞろい', color: '#c9a227' },
};

export const RACE_NAMES = [
  ['ハイボール記念', '芝2000m'], ['生ビール賞', '芝1600m'], ['テキーラステークス', '芝1200m'],
  ['乾杯グランプリ', '芝2400m'], ['二日酔いダービー', '芝2400m'], ['千鳥足ステークス', '芝1800m'],
  ['終電カップ', '芝1600m'], ['おかわり特別', '芝2000m'], ['レモンサワー杯', '芝1400m'],
  ['とりあえず生ステークス', '芝1800m'], ['梅酒ロック賞', '芝2200m'], ['シメのラーメン記念', '芝2500m'],
];
export const FINAL_RACE_NAMES = [
  ['ウォッカ大賞典', '芝2500m'], ['ベベ回避グランプリ', '芝2500m'], ['大逆転記念', '芝2400m'],
];

export const ENVS = {
  day: { label: '晴', icon: '☀️', going: '良' },
  sunset: { label: '夕焼け', icon: '🌇', going: '良' },
  night: { label: 'ナイター', icon: '🌙', going: '良' },
  rain: { label: '雨', icon: '🌧️', going: '重' },
};

export const PLAYER_COLORS = ['#ff5a5f', '#3fa7ff', '#ffc233', '#3ddc84', '#c77dff', '#ff8fab', '#4dd0e1', '#ff9f43'];
