/**
 * 全角半角変換ユーティリティ
 *
 * チーム名、選手名、背番号、会場名などの入力を正規化
 */

/**
 * 全角数字を半角に変換
 * ０１２３４５６７８９ → 0123456789
 */
export function toHalfWidthNumbers(str: string): string {
  return str.replace(/[０-９]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xFEE0)
  );
}

/**
 * 全角英字を半角に変換
 * Ａ-Ｚ, ａ-ｚ → A-Z, a-z
 */
export function toHalfWidthAlphabet(str: string): string {
  return str.replace(/[Ａ-Ｚａ-ｚ]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xFEE0)
  );
}

/**
 * 全角スペースを半角に変換
 */
export function toHalfWidthSpace(str: string): string {
  return str.replace(/　/g, ' ');
}

/**
 * 全角記号を半角に変換（よく使うもの）
 */
export function toHalfWidthSymbols(str: string): string {
  const symbolMap: Record<string, string> = {
    '－': '-',
    '＿': '_',
    '（': '(',
    '）': ')',
    '［': '[',
    '］': ']',
    '｛': '{',
    '｝': '}',
    '／': '/',
    '＼': '\\',
    '．': '.',
    '，': ',',
    '：': ':',
    '；': ';',
    '！': '!',
    '？': '?',
    '＠': '@',
    '＃': '#',
    '＄': '$',
    '％': '%',
    '＆': '&',
    '＊': '*',
    '＋': '+',
    '＝': '=',
    '＜': '<',
    '＞': '>',
    '｜': '|',
    '～': '~',
    '｀': '`',
    '＂': '"',
    '＇': "'",
  };

  return str.replace(/[－＿（）［］｛｝／＼．，：；！？＠＃＄％＆＊＋＝＜＞｜～｀＂＇]/g,
    (char) => symbolMap[char] || char
  );
}

/**
 * 半角カタカナを全角に変換
 */
export function toFullWidthKatakana(str: string): string {
  const kanaMap: Record<string, string> = {
    'ｱ': 'ア', 'ｲ': 'イ', 'ｳ': 'ウ', 'ｴ': 'エ', 'ｵ': 'オ',
    'ｶ': 'カ', 'ｷ': 'キ', 'ｸ': 'ク', 'ｹ': 'ケ', 'ｺ': 'コ',
    'ｻ': 'サ', 'ｼ': 'シ', 'ｽ': 'ス', 'ｾ': 'セ', 'ｿ': 'ソ',
    'ﾀ': 'タ', 'ﾁ': 'チ', 'ﾂ': 'ツ', 'ﾃ': 'テ', 'ﾄ': 'ト',
    'ﾅ': 'ナ', 'ﾆ': 'ニ', 'ﾇ': 'ヌ', 'ﾈ': 'ネ', 'ﾉ': 'ノ',
    'ﾊ': 'ハ', 'ﾋ': 'ヒ', 'ﾌ': 'フ', 'ﾍ': 'ヘ', 'ﾎ': 'ホ',
    'ﾏ': 'マ', 'ﾐ': 'ミ', 'ﾑ': 'ム', 'ﾒ': 'メ', 'ﾓ': 'モ',
    'ﾔ': 'ヤ', 'ﾕ': 'ユ', 'ﾖ': 'ヨ',
    'ﾗ': 'ラ', 'ﾘ': 'リ', 'ﾙ': 'ル', 'ﾚ': 'レ', 'ﾛ': 'ロ',
    'ﾜ': 'ワ', 'ﾝ': 'ン', 'ｦ': 'ヲ',
    'ｧ': 'ァ', 'ｨ': 'ィ', 'ｩ': 'ゥ', 'ｪ': 'ェ', 'ｫ': 'ォ',
    'ｬ': 'ャ', 'ｭ': 'ュ', 'ｮ': 'ョ', 'ｯ': 'ッ',
    'ﾞ': '゛', 'ﾟ': '゜', 'ｰ': 'ー',
  };

  // 濁点・半濁点の結合処理
  let result = str;
  // ガ行、ザ行など濁点付き
  result = result.replace(/ｳﾞ/g, 'ヴ');
  result = result.replace(/([ｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾊﾋﾌﾍﾎ])ﾞ/g, (_, char) => {
    const base = kanaMap[char];
    return base ? String.fromCharCode(base.charCodeAt(0) + 1) : char + '゛';
  });
  // パ行など半濁点付き
  result = result.replace(/([ﾊﾋﾌﾍﾎ])ﾟ/g, (_, char) => {
    const base = kanaMap[char];
    return base ? String.fromCharCode(base.charCodeAt(0) + 2) : char + '゜';
  });

  // 残りの単独文字を変換
  return result.replace(/[ｱ-ﾝｦｧ-ｮｯｰﾞﾟ]/g, (char) => kanaMap[char] || char);
}

/**
 * 背番号の正規化（数字のみ抽出、全角→半角）
 * "１０番" → "10"
 * "＃５" → "5"
 */
export function normalizeJerseyNumber(str: string): string {
  // 全角数字を半角に変換
  const halfWidth = toHalfWidthNumbers(str);
  // 数字のみ抽出
  const numbers = halfWidth.replace(/[^0-9]/g, '');
  return numbers;
}

/**
 * チーム名・選手名の正規化
 * - 全角英数字→半角
 * - 全角スペース→半角
 * - 半角カナ→全角
 * - 前後の空白を除去
 * - 連続スペースを1つに
 */
export function normalizeTeamName(str: string): string {
  let result = str;
  result = toHalfWidthNumbers(result);
  result = toHalfWidthAlphabet(result);
  result = toHalfWidthSpace(result);
  result = toFullWidthKatakana(result);
  result = result.trim();
  result = result.replace(/\s+/g, ' ');
  return result;
}

/**
 * 選手名の正規化（チーム名と同じ処理）
 */
export function normalizePlayerName(str: string): string {
  return normalizeTeamName(str);
}

/**
 * 会場名の正規化
 */
export function normalizeVenueName(str: string): string {
  return normalizeTeamName(str);
}

/**
 * 汎用的な入力正規化
 * - 全角英数字記号→半角
 * - 全角スペース→半角
 * - 半角カナ→全角
 * - 前後の空白を除去
 */
export function normalizeInput(str: string): string {
  if (!str) return str;

  let result = str;
  result = toHalfWidthNumbers(result);
  result = toHalfWidthAlphabet(result);
  result = toHalfWidthSpace(result);
  result = toHalfWidthSymbols(result);
  result = toFullWidthKatakana(result);
  result = result.trim();
  return result;
}

/**
 * 検索用の正規化（大文字小文字を統一、全角半角統一）
 */
export function normalizeForSearch(str: string): string {
  if (!str) return str;

  let result = normalizeInput(str);
  result = result.toLowerCase();
  return result;
}

/**
 * 2つの文字列が正規化後に一致するか比較
 */
export function isNormalizedEqual(str1: string, str2: string): boolean {
  return normalizeForSearch(str1) === normalizeForSearch(str2);
}

/**
 * 正規化後の文字列が部分一致するか
 */
export function normalizedIncludes(haystack: string, needle: string): boolean {
  return normalizeForSearch(haystack).includes(normalizeForSearch(needle));
}
