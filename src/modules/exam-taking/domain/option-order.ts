// "đáp án a, b đúng", "a, b và c đúng", "phương án a và c". `\b` is ASCII-only, so Vietnamese words end on `\s` instead.
const LETTER_LIST = /(^|[\s(])[a-e]\s*(,|và|\+|&)\s*[a-e]([\s.,)]|$)|(đáp án|phương án|ý|câu)\s+[a-e]([\s.,)]|$)/iu;
// "Cả hai phương án trên", "Tất cả các ý trên", "Một trong các nguyên nhân trên", "Các đáp án nêu trên đều sai".
// "trên" must close the option: "Chỉ cần kiểm tra các đèn báo trên bảng điều khiển" is an ordinary option.
const ABOVE = /(^|\s)(cả\s+(hai|ba|bốn)|tất\s+cả|các|những)\s[^.]*\strên(\s+đều\s+\S+)?[\s.]*$/iu;

/** True when an option points at other options, so shuffling would change its meaning. */
export function referencesOtherOptions(texts: string[]): boolean {
  return texts.some((text) => LETTER_LIST.test(text) || ABOVE.test(text));
}

/** Letter shown before the option at `index`: "a", "b", … */
export function optionLetter(index: number): string {
  return String.fromCharCode(97 + index);
}
