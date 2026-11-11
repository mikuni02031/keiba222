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
  id: 'L' + i, kind: 'legend', name: r[0], rating: r[1], style: r[2], coat: r[3], catch: r[4], bigNige: !!r[5],
}));

// プロ野球の助っ人外国人（2020年以降にNPB在籍）の名を冠した馬
const P = [
  ['バウアー', 97, 'nige', 'darkbay', 'サイ・ヤング賞右腕'],
  ['ライデル', 97, 'oikomi', 'black', '絶対的守護神'],
  ['モイネロ', 96, 'sashi', 'bay', '魔球カーブの左腕'],
  ['オースティン', 96, 'senko', 'chestnut', 'ハマの大砲'],
  ['レイエス', 95, 'oikomi', 'darkbay', '規格外のパワー'],
  ['サンタナ', 95, 'senko', 'bay', '燕の安打製造機'],
  ['スアレス', 95, 'oikomi', 'black', '160キロの守護神'],
  ['ソト', 94, 'sashi', 'bay', '2年連続本塁打王'],
  ['オスナ', 93, 'sashi', 'darkbay', '勝負強い燕の主砲'],
  ['ポランコ', 93, 'oikomi', 'bay', 'パ・リーグ本塁打王'],
  ['ビシエド', 92, 'senko', 'darkbay', 'エル・タンケ'],
  ['デスパイネ', 92, 'oikomi', 'bay', 'キューバの大砲'],
  ['マクガフ', 91, 'oikomi', 'chestnut', '燕の守護神'],
  ['グラシアル', 91, 'senko', 'black', '万能のキューバ戦士'],
  ['バレンティン', 90, 'oikomi', 'darkbay', 'シーズン60本塁打'],
  ['エスコバー', 90, 'senko', 'bay', '剛腕セットアッパー'],
  ['マーティン', 90, 'nige', 'bay', '強肩強打'],
  ['レアード', 90, 'sashi', 'chestnut', 'スシボーイ'],
  ['ヘルナンデス', 89, 'senko', 'bay', '途中加入の救世主'],
  ['ポンセ', 88, 'nige', 'chestnut', 'ノーヒットノーラン達成'],
  ['マルテ', 88, 'senko', 'darkbay', 'ラパンパラ'],
  ['サンズ', 88, 'nige', 'chestnut', 'ハッピーハンズ'],
  ['ジョーンズ', 88, 'senko', 'black', '元メジャーのスター'],
  ['ウィーラー', 87, 'senko', 'bay', 'ムードメーカー'],
  ['マクブルーム', 87, 'senko', 'chestnut', '鯉の4番'],
  ['セデーニョ', 87, 'sashi', 'darkbay', '猛牛の大砲'],
  ['ウォーカー', 86, 'oikomi', 'black', '一発の魅力'],
  ['マキノン', 86, 'senko', 'bay', '堅実な一塁手'],
  ['メヒア', 85, 'oikomi', 'darkbay', '獅子の大砲'],
  ['メルセデス', 85, 'senko', 'bay', '技巧派サウスポー'],
  ['ノイジー', 84, 'senko', 'chestnut', '強肩の外野手'],
  ['ミエセス', 80, 'oikomi', 'bay', '愛されキャラ'],
  ['オドーア', 73, 'nige', 'bay', '開幕前に電撃帰国', true],
];
export const SUKETTO = P.map((r, i) => ({
  id: 'P' + i, kind: 'player', name: r[0], rating: r[1], style: r[2], coat: r[3], catch: r[4], bigNige: !!r[5],
}));

// プロ野球12球団の名を冠した馬
const TM = [
  ['ホークス', 97, 'senko', 'black', '常勝軍団'],
  ['タイガース', 96, 'sashi', 'chestnut', '六甲おろしが響く'],
  ['ジャイアンツ', 96, 'senko', 'darkbay', '球界の盟主'],
  ['ベイスターズ', 94, 'oikomi', 'bay', 'ハマの下剋上'],
  ['バファローズ', 94, 'sashi', 'darkbay', 'パ・リーグ3連覇'],
  ['ファイターズ', 93, 'nige', 'white', '新球場の主役'],
  ['カープ', 91, 'nige', 'chestnut', '鯉のぼりの季節に強い'],
  ['スワローズ', 91, 'sashi', 'bay', '傘の花が咲く'],
  ['マリーンズ', 91, 'oikomi', 'grey', '幕張の風に乗る'],
  ['イーグルス', 89, 'senko', 'darkbay', '東北の翼'],
  ['ドラゴンズ', 87, 'senko', 'bay', '守り勝つ野球'],
  ['ライオンズ', 86, 'sashi', 'grey', '獅子奮迅'],
];
export const TEAMS = TM.map((r, i) => ({
  id: 'T' + i, kind: 'team', name: r[0], rating: r[1], style: r[2], coat: r[3], catch: r[4], bigNige: false,
}));

// 出走候補の全プール
export const POOL = LEGENDS.concat(SUKETTO, TEAMS);
export const KIND_LABEL = { legend: '名馬', player: '助っ人', team: '球団', friend: '特別出走' };

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
  dream: { label: 'ドリームレース', desc: '最強クラスが勢ぞろい', color: '#c9a227' },
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
