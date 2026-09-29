import type { DocBlock, DocRun } from './docx-reader';
import { contentKey, IMPORT_TYPE_NAMES, type ImportRow, type SkippedRow } from './question-import';
import { OPTION_IDS } from './question-draft';

// Turns the paragraphs of a center question file into import rows. Rules come from the center's own files
// (docs/implementation/2026-09-28-word-import.md): "Câu N." starts a question, options are Word numbering or typed
// letters, and the correct option carries a mark chosen per file (red text in most files).

export type AnswerMarking = 'color' | 'highlight' | 'bold' | 'underline';
export const ANSWER_MARKINGS: AnswerMarking[] = ['color', 'highlight', 'bold', 'underline'];

type Marks = Record<AnswerMarking, boolean>;

interface WordOption {
  text: string;
  /** Letter shown before the option: typed ("b" for "b) …") or from Word letter numbering; null when unknown. */
  letter: string | null;
  marks: Marks;
  /** Marked, but some letters or digits of the option are not ("Có mái che…" with "Có" left black). */
  partial: Marks;
}

export interface WordQuestion {
  /** 1-based position in the file, unique even when the file repeats a number. */
  index: number;
  label: string;
  number: number;
  stem: string;
  options: WordOption[];
  images: string[];
  topic: string;
  /** Letters from a "Đáp án: B" line under the question. */
  answerLine: string[] | null;
  /** Paragraphs after an option that were neither an option nor an answer line, joined to the option above. */
  joinedText: { text: string; option: WordOption }[];
  /** True once a "Giải thích:" paragraph was met: what follows up to the next question is not part of it. */
  explained: boolean;
}

export interface WordDocument {
  questions: WordQuestion[];
  /** Question number → letters, from an answer list after a "ĐÁP ÁN" heading. */
  answerList: Map<number, string[]>;
}

const QUESTION_START = /^\s*Câu\s*(\d+)\s*[.:)]?\s*/iu;
// "PHẦN I – …", "PHẦN 2: …"; the numeral must stand alone, so "PHẦN LÝ THUYẾT" is not read as part L.
const SECTION = /^\s*PHẦN\s+([IVXLC]+|\d+)(?![\p{L}\p{N}])\s*[.:–—-]?\s*/u;
// Signature block and distribution list after the last question.
const FOOTER = /^\s*(Nơi nhận|Hải Phòng,?\s*ngày)|^\s*(TRƯỞNG|PHÓ GIÁM ĐỐC|GIÁM ĐỐC|NGƯỜI (LẬP|DUYỆT|RA ĐỀ|KIỂM TRA)|DUYỆT CỦA)\b/u;
const ANSWER_HEADING = /^\s*(BẢNG\s+)?ĐÁP\s+ÁN(\s+(ĐÚNG|TRẮC NGHIỆM|CÂU HỎI))?\s*[:.]?\s*$/u;
const ANSWER_LINE = /^\s*(Đáp\s*án(\s*đúng)?|ĐA)\s*[:：]\s*([a-j](\s*(,|;|và|&)\s*[a-j])*)\s*\.?\s*$/iu;
const TYPED_OPTION = /(^|\s)([a-jA-J])\s*[.)]\s+/gu;
// An explanation under the options ("Giải thích: …"); the bank has no field for it.
const EXPLANATION = /^\s*(Giải\s*thích|Hướng\s*dẫn\s*giải)\s*[:：]/iu;

function clean(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function isRed(color: string | null): boolean {
  if (!color) return false;
  const [r, g, b] = [0, 2, 4].map((offset) => parseInt(color.slice(offset, offset + 2), 16));
  return r >= 0xb0 && g <= 0x60 && b <= 0x60;
}

/** Characters of a block with the marks of their run. */
function markedChars(runs: DocRun[]): { char: string; marks: Marks }[] {
  return runs.flatMap((run) => {
    const marks: Marks = { color: isRed(run.color), highlight: run.highlight, bold: run.bold, underline: run.underline };
    return [...run.text].map((char) => ({ char, marks }));
  });
}

/** An option counts as marked when most of its letters and digits carry the mark; punctuation is not counted. */
function marksOf(chars: { char: string; marks: Marks }[]): Pick<WordOption, 'marks' | 'partial'> {
  const visible = chars.filter((item) => /[\p{L}\p{N}]/u.test(item.char));
  const marks = { color: false, highlight: false, bold: false, underline: false };
  const partial = { ...marks };
  if (visible.length === 0) return { marks, partial };
  for (const marking of ANSWER_MARKINGS) {
    const count = visible.filter((item) => item.marks[marking]).length;
    marks[marking] = count * 2 > visible.length;
    partial[marking] = marks[marking] && count < visible.length;
  }
  return { marks, partial };
}

/**
 * Options on one line. Typed: "a. 5 vòng  b. 4 vòng  c. 3 vòng". Two columns: a Word-numbered option followed by a typed
 * one ("Nhảy khỏi xe        c) Giảm ga …", Word shows "a)" in front), or "A. HMI        C. SCADA". `lead` is the
 * numbering letter of the paragraph (null when it has none or is not numbered).
 */
function lineOptions(block: DocBlock, numbered: boolean, lead: string | null): WordOption[] | null {
  const chars = markedChars(block.runs);
  const text = chars.map((item) => item.char).join('');
  const starts: { at: number; body: number; letter: string | null }[] = numbered ? [{ at: 0, body: 0, letter: lead }] : [];
  for (const match of text.matchAll(TYPED_OPTION)) {
    const letter = match[2].toLowerCase();
    const at = (match.index ?? 0) + match[1].length;
    const body = (match.index ?? 0) + match[0].length;
    const before = text.slice(0, at);
    if (before.trim() === '') {
      // The letter opens the line (typed, or typed again after Word's own numbering): it names this option.
      starts.splice(0, starts.length, { at, body, letter });
      continue;
    }
    const previous = starts[starts.length - 1];
    if (!previous) return null;
    // A second column is set off by a tab or several spaces and starts an option whatever its letter (a file may
    // repeat one, "B. … B. …"; the letter check below then flags the question). On a plain line only the next letter
    // counts, so "đáp án a, c. đúng" stays one option.
    const column = /(\t| {2})[ \t]*$/.test(before);
    const next = previous.letter !== null && letter.charCodeAt(0) === previous.letter.charCodeAt(0) + 1;
    if (next || column) starts.push({ at, body, letter });
  }
  if (starts.length === 0) return null;
  return starts.map((start, index) => {
    const slice = chars.slice(start.body, starts[index + 1]?.at ?? chars.length);
    return { text: clean(slice.map((item) => item.char).join('')), letter: start.letter, ...marksOf(slice) };
  });
}

/** Options in the order of their letters when every letter is known and used once (two-column layouts read a, c, b, d). */
function orderOptions(options: WordOption[]): WordOption[] {
  const letters = options.map((option) => option.letter);
  if (letters.some((letter) => letter === null) || new Set(letters).size !== letters.length) return options;
  return [...options].sort((a, b) => (a.letter ?? '').localeCompare(b.letter ?? ''));
}

function letters(raw: string): string[] {
  return (raw.match(/[a-j]/giu) ?? []).map((letter) => letter.toUpperCase());
}

/** "1-B", "1. B", "Câu 1: B", "1B" anywhere in the text. */
function answerPairs(text: string, into: Map<number, string[]>): void {
  for (const match of text.matchAll(/(?:Câu\s*)?(\d+)\s*[-–.:)]?\s*([A-Ja-j])(?![\p{L}\p{N}])/gu)) {
    into.set(Number(match[1]), [match[2].toUpperCase()]);
  }
}

/** Answer tables: a row of numbers followed by a row of letters, or rows of "number | letter" cells. */
function readAnswerRows(rows: string[][], into: Map<number, string[]>): void {
  for (let index = 0; index < rows.length; index++) {
    const cells = rows[index];
    const next = rows[index + 1];
    const numbers = cells.every((cell) => /^\d+$/.test(cell));
    if (numbers && next && next.length === cells.length && next.every((cell) => /^[A-Ja-j]$/.test(cell))) {
      cells.forEach((cell, position) => into.set(Number(cell), [next[position].toUpperCase()]));
      index++;
      continue;
    }
    answerPairs(cells.join(' '), into);
  }
}

/** Cuts a block at a character position; pictures stay with the first part. */
function splitBlock(block: DocBlock, at: number): [DocBlock, DocBlock] {
  const head: DocRun[] = [];
  const tail: DocRun[] = [];
  let seen = 0;
  for (const run of block.runs) {
    const chars = [...run.text];
    const cut = Math.max(0, Math.min(chars.length, at - seen));
    if (cut > 0) head.push({ ...run, text: chars.slice(0, cut).join('') });
    if (cut < chars.length) tail.push({ ...run, text: chars.slice(cut).join('') });
    seen += chars.length;
  }
  const text = (runs: DocRun[]) => runs.map((run) => run.text).join('');
  return [
    { ...block, runs: head, text: text(head) },
    { ...block, runs: tail, text: text(tail), images: [], numbering: null },
  ];
}

/** Position of "Câu <next>." inside the text (not at its start), for a question typed on the line of an option. */
function nextQuestionInside(text: string, next: number): number | null {
  const match = new RegExp(String.raw`\sCâu\s*${next}\s*[.:)]`, 'u').exec(text);
  if (!match || text.slice(0, match.index).trim() === '') return null;
  return [...text.slice(0, match.index + 1)].length;
}

export function readWordQuestions(input: DocBlock[]): WordDocument {
  const questions: WordQuestion[] = [];
  const answerList = new Map<number, string[]>();
  let current: WordQuestion | null = null;
  let topic = '';
  let answerRows: Map<number | string, string[]> | null = null;
  const blocks = [...input];

  for (let position = 0; position < blocks.length; position++) {
    let block = blocks[position];
    // Some files type a whole question in one paragraph with manual line breaks ("Câu 1. …⏎A. …⇥B. …⏎C. …"):
    // each line is read as its own paragraph.
    const chars = [...block.text.trimEnd()];
    const firstText = chars.findIndex((char) => char.trim() !== '');
    const lineBreak = firstText === -1 ? -1 : chars.indexOf('\n', firstText);
    const nextQuestion = current ? nextQuestionInside(block.text, current.number + 1) : null;
    const cut = [lineBreak > 0 ? lineBreak + 1 : null, nextQuestion].filter((value): value is number => value !== null).sort((a, b) => a - b)[0];
    if (cut !== undefined) {
      const [head, tail] = splitBlock(block, cut);
      block = head;
      blocks.splice(position + 1, 0, tail);
    }
    const text = clean(block.text);

    if (answerRows) {
      if (FOOTER.test(text)) break;
      const key = block.tableRow ?? `p${position}`;
      if (text) answerRows.set(key, [...(answerRows.get(key) ?? []), text]);
      continue;
    }
    if (questions.length > 0 && FOOTER.test(text)) break;
    if (ANSWER_HEADING.test(text) && questions.length > 0) {
      answerRows = new Map();
      current = null;
      continue;
    }

    const section = SECTION.exec(text);
    if (section && !block.numbering) {
      topic = clean(text.slice(section[0].length)) || clean(text);
      current = null;
      continue;
    }

    const start = QUESTION_START.exec(text);
    if (start) {
      const stemChars = markedChars(block.runs);
      const offset = [...block.text].length - [...block.text.replace(QUESTION_START, '')].length;
      current = {
        index: questions.length + 1,
        label: `Câu ${start[1]}`,
        number: Number(start[1]),
        stem: clean(stemChars.slice(offset).map((item) => item.char).join('')),
        options: [],
        images: [...block.images],
        topic,
        answerLine: null,
        joinedText: [],
        explained: false,
      };
      questions.push(current);
      continue;
    }
    if (!current) continue;

    current.images.push(...block.images);
    if (!text) continue;

    const answerLine = ANSWER_LINE.exec(text);
    if (answerLine) {
      current.answerLine = letters(answerLine[3]);
      continue;
    }
    if (EXPLANATION.test(text)) current.explained = true;
    if (current.explained) continue;

    const numbered = block.numbering !== null && block.numbering.format !== 'bullet';
    const lead = numbered && block.numbering && /letter/i.test(block.numbering.format) ? String.fromCharCode(96 + block.numbering.value) : null;
    const options = lineOptions(block, numbered, lead);
    if (options) {
      current.options.push(...options);
    } else if (current.options.length === 0) {
      // Stem continued on the next line, or beside a picture in a table.
      current.stem = clean(`${current.stem} ${text}`);
    } else {
      // Usually the wrapped end of the option above (a manual line break turned into a paragraph).
      const last = current.options[current.options.length - 1];
      last.text = clean(`${last.text} ${text}`);
      current.joinedText.push({ text, option: last });
    }
  }

  if (answerRows) {
    readAnswerRows([...answerRows.values()], answerList);
  }
  return { questions, answerList };
}

/** The marking that gives the most questions exactly one marked option; null when no option is marked at all. */
export function proposeMarking(document: WordDocument): AnswerMarking | null {
  let best: AnswerMarking | null = null;
  let bestCount = 0;
  for (const marking of ANSWER_MARKINGS) {
    const count = document.questions.filter((question) => question.options.filter((option) => option.marks[marking]).length === 1).length;
    if (count > bestCount) {
      best = marking;
      bestCount = count;
    }
  }
  return best;
}

export const MARKING_LABELS: Record<AnswerMarking, string> = {
  color: 'Chữ màu đỏ',
  highlight: 'Tô nền (highlight)',
  bold: 'In đậm',
  underline: 'Gạch chân',
};

export interface WordRow extends ImportRow {
  label: string;
  /** Package path of the picture, e.g. "word/media/image3.png"; the row's imageFile is its file name. */
  imagePath: string | null;
  reviewNotes: string[];
}

export interface WordSheet {
  rows: WordRow[];
  errors: SkippedRow[];
  notices: string[];
}

const BROWSER_IMAGE = /\.(jpe?g|png|gif|webp)$/i;

function describe(ids: string[]): string {
  return ids.join(', ');
}

/** Import rows for the chosen marking, plus the questions that cannot be imported and why. */
export function buildWordSheet(document: WordDocument, marking: AnswerMarking | null): WordSheet {
  const sheet: WordSheet = { rows: [], errors: [], notices: [] };
  const markingName = marking ? MARKING_LABELS[marking].toLowerCase() : null;
  if (document.questions.length === 0) {
    sheet.notices.push('Không thấy câu nào bắt đầu bằng "Câu 1", "Câu 2"… trong file.');
    return sheet;
  }
  if (!marking && document.answerList.size === 0 && !document.questions.some((question) => question.answerLine)) {
    sheet.notices.push('File không có đáp án: không phương án nào được tô màu, tô nền, in đậm hay gạch chân, không có dòng "Đáp án:" và không có bảng đáp án cuối file.');
  }

  const explained = document.questions.filter((question) => question.explained).length;
  if (explained > 0) sheet.notices.push(`Bỏ qua phần "Giải thích" ở ${explained} câu: ngân hàng câu hỏi chưa có chỗ lưu lời giải thích.`);

  for (const question of document.questions) {
    const fail = (reason: string) => sheet.errors.push({ line: question.index, label: question.label, stem: question.stem, reason });
    const notes: string[] = [];
    const options = orderOptions(question.options);

    if (options.length > OPTION_IDS.length) {
      fail(`Có ${options.length} phương án, tối đa ${OPTION_IDS.length}. Thường là thiếu dòng "Câu …" giữa hai câu.`);
      continue;
    }

    const marked = marking
      ? options.flatMap((option, index) => (option.marks[marking] ? [OPTION_IDS[index] as string] : []))
      : [];
    const sources: [string, string[]][] = [];
    if (marked.length > 0) sources.push([markingName ?? '', marked]);
    if (question.answerLine) sources.push(['dòng "Đáp án:"', question.answerLine]);
    const listed = document.answerList.get(question.number);
    if (listed) sources.push(['bảng đáp án cuối file', listed]);

    if (sources.length === 0) {
      fail(marking ? `Không có phương án nào ${markingName} và không có dòng "Đáp án:".` : 'Không thấy đáp án đúng.');
      continue;
    }
    const [firstSource, answer] = sources[0];
    const disagree = sources.find(([, ids]) => describe(ids) !== describe(answer));
    if (disagree) {
      fail(`Đáp án theo ${firstSource} là ${describe(answer)}, theo ${disagree[0]} là ${describe(disagree[1])}.`);
      continue;
    }
    const partly = marking ? options.flatMap((option, index) => (option.partial[marking] ? [OPTION_IDS[index] as string] : [])) : [];
    if (partly.length > 0) notes.push(`Đáp án ${describe(partly)} chỉ có một phần chữ được đánh dấu (${markingName}): kiểm tra lại đáp án.`);
    if (answer.length > 1) notes.push(`${answer.length} phương án được đánh dấu (${describe(answer)}), nên nhập thành câu nhiều đáp án.`);

    const shownLetters = options.map((option) => option.letter);
    // Back to "a" after a full run of options means the next question's "Câu" line is missing or mistyped
    // ("Cây 13."); an "a" right after the first option is a list-level slip and only needs a look.
    const restart = shownLetters.findIndex((letter, index) => index > 1 && letter === 'a');
    if (restart > 1) {
      fail(`Phương án thứ ${restart + 1} lại bắt đầu từ a: có thể thiếu hoặc gõ sai dòng "Câu …" của câu sau.`);
      continue;
    }
    if (shownLetters.some((letter, index) => letter !== null && letter !== String.fromCharCode(97 + index))) {
      const first = shownLetters.find((letter) => letter !== null);
      notes.push(first && first !== 'a'
        ? `Phương án đầu tiên ghi "${first})": có thể phương án a nằm lẫn trong đề bài.`
        : 'Chữ cái của các phương án không liền nhau (thiếu hoặc lặp chữ).');
    }

    const images = [...new Set(question.images)];
    const image = images[0] ?? null;
    if (image && !BROWSER_IMAGE.test(image)) {
      fail(`Ảnh của câu ở dạng ${image.split('.').pop()?.toUpperCase()}, trình duyệt không hiển thị được. Trong Word, bấm chuột phải vào ảnh, "Save as Picture…" dạng PNG rồi chèn lại.`);
      continue;
    }
    if (images.length > 1) notes.push(`Câu có ${images.length} ảnh, chỉ lấy ảnh đầu tiên.`);
    for (const joined of question.joinedText) notes.push(`Đoạn "${joined.text.slice(0, 80)}" được nối vào cuối phương án ${OPTION_IDS[options.indexOf(joined.option)]}.`);

    sheet.rows.push({
      line: question.index,
      label: question.label,
      stem: question.stem,
      optionTexts: options.map((option) => option.text),
      answer: answer.join(';'),
      questionType: answer.length > 1 ? IMPORT_TYPE_NAMES.multiple_choice : IMPORT_TYPE_NAMES.single_choice,
      keys: '',
      topic: question.topic,
      difficulty: '',
      points: '',
      imageFile: image ? image.split('/').pop() ?? '' : '',
      imagePath: image,
      reviewNotes: notes,
    });
  }

  // Same stem and options with different answers: neither can be trusted.
  const groups = new Map<string, WordRow[]>();
  for (const row of sheet.rows) {
    const key = contentKey(row.stem, row.optionTexts.map((text, index) => ({ id: OPTION_IDS[index], text })));
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const conflicting = new Set<WordRow>();
  for (const rows of groups.values()) {
    if (new Set(rows.map((row) => row.answer)).size < 2) continue;
    const summary = rows.map((row) => `${row.label}: ${row.answer.replace(/;/g, ', ')}`).join('; ');
    for (const row of rows) {
      conflicting.add(row);
      sheet.errors.push({ line: row.line, label: row.label, stem: row.stem, reason: `Cùng nội dung nhưng khác đáp án (${summary}).` });
    }
  }
  sheet.rows = sheet.rows.filter((row) => !conflicting.has(row));
  sheet.errors.sort((a, b) => a.line - b.line);
  return sheet;
}
