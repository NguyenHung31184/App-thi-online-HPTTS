// Reads the parts of a .docx the question import needs: paragraphs in reading order, run formatting, automatic
// numbering and pictures. Tests run in Node without a DOM, so the XML is read by a small tokenizer; Word writes
// well-formed XML, which is all it has to handle.

export interface XmlNode {
  name: string;
  attrs: Record<string, string>;
  children: XmlNode[];
  /** Text content, for text nodes only (name '#text'). */
  text: string;
}

const ENTITIES: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

function decode(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (whole, code: string) => {
    if (code[0] === '#') {
      const point = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isNaN(point) ? whole : String.fromCodePoint(point);
    }
    return ENTITIES[code] ?? whole;
  });
}

const TOKEN = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[([\s\S]*?)\]\]>|<!DOCTYPE[^>]*>|<(\/?)([^\s/>]+)([^>]*?)(\/?)>|([^<]+)/g;
const ATTR = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

export function parseXml(xml: string): XmlNode {
  const root: XmlNode = { name: '#root', attrs: {}, children: [], text: '' };
  const stack: XmlNode[] = [root];
  for (const match of xml.matchAll(TOKEN)) {
    const [, cdata, closing, name, rawAttrs, selfClosing, text] = match;
    const parent = stack[stack.length - 1];
    if (text !== undefined || cdata !== undefined) {
      parent.children.push({ name: '#text', attrs: {}, children: [], text: cdata ?? decode(text) });
    } else if (name) {
      if (closing) {
        // Pop to the matching element; a stray closing tag is ignored rather than unwinding the whole tree.
        const index = stack.map((node) => node.name).lastIndexOf(name);
        if (index > 0) stack.length = index;
        continue;
      }
      const attrs: Record<string, string> = {};
      for (const [, key, double, single] of (rawAttrs ?? '').matchAll(ATTR)) attrs[key] = decode(double ?? single ?? '');
      const node: XmlNode = { name, attrs, children: [], text: '' };
      parent.children.push(node);
      if (!selfClosing) stack.push(node);
    }
  }
  return root;
}

function child(node: XmlNode | undefined, name: string): XmlNode | undefined {
  return node?.children.find((item) => item.name === name);
}

function children(node: XmlNode | undefined, name: string): XmlNode[] {
  return node?.children.filter((item) => item.name === name) ?? [];
}

function find(node: XmlNode, name: string): XmlNode | undefined {
  for (const item of node.children) {
    if (item.name === name) return item;
    const found = find(item, name);
    if (found) return found;
  }
  return undefined;
}

export interface DocRun {
  text: string;
  /** Font color as six hex digits, or null for automatic/none. */
  color: string | null;
  /** Highlight or a shading fill behind the text. */
  highlight: boolean;
  bold: boolean;
  underline: boolean;
}

export interface DocNumbering {
  /** Word number format: lowerLetter, upperLetter, decimal, bullet, … */
  format: string;
  levelText: string;
  /** Number Word shows for this paragraph, from 1 ("b)" is 2). */
  value: number;
}

type LevelDefinition = Omit<DocNumbering, 'value'> & { start: number };

export interface DocBlock {
  runs: DocRun[];
  text: string;
  /** Picture paths inside the package, e.g. "word/media/image1.png". */
  images: string[];
  numbering: DocNumbering | null;
  /** Position of the table row (counted across the document) for a paragraph inside a table; null outside tables. */
  tableRow: number | null;
}

export interface DocxParts {
  document: string;
  numbering?: string | null;
  relationships?: string | null;
}

type NumberingTable = Map<string, Map<string, LevelDefinition>>;

function readNumbering(xml: string | null | undefined): NumberingTable {
  const table: NumberingTable = new Map();
  if (!xml) return table;
  const root = find(parseXml(xml), 'w:numbering');
  if (!root) return table;
  const abstract = new Map<string, Map<string, LevelDefinition>>();
  for (const node of children(root, 'w:abstractNum')) {
    const levels = new Map<string, LevelDefinition>();
    for (const level of children(node, 'w:lvl')) {
      levels.set(level.attrs['w:ilvl'] ?? '0', {
        format: child(level, 'w:numFmt')?.attrs['w:val'] ?? 'decimal',
        levelText: child(level, 'w:lvlText')?.attrs['w:val'] ?? '',
        start: Number(child(level, 'w:start')?.attrs['w:val'] ?? 1) || 1,
      });
    }
    abstract.set(node.attrs['w:abstractNumId'] ?? '', levels);
  }
  for (const node of children(root, 'w:num')) {
    const base = abstract.get(child(node, 'w:abstractNumId')?.attrs['w:val'] ?? '');
    if (!base) continue;
    const levels = new Map(base);
    for (const override of children(node, 'w:lvlOverride')) {
      const level = override.attrs['w:ilvl'] ?? '0';
      const start = child(override, 'w:startOverride')?.attrs['w:val'];
      const current = levels.get(level);
      if (current && start) levels.set(level, { ...current, start: Number(start) || 1 });
    }
    table.set(node.attrs['w:numId'] ?? '', levels);
  }
  return table;
}

function readRelationships(xml: string | null | undefined): Map<string, string> {
  const targets = new Map<string, string>();
  if (!xml) return targets;
  const root = find(parseXml(xml), 'Relationships');
  for (const node of children(root, 'Relationship')) {
    if (node.attrs.TargetMode === 'External') continue;
    const target = node.attrs.Target ?? '';
    targets.set(node.attrs.Id ?? '', target.startsWith('/') ? target.slice(1) : `word/${target.replace(/^\.\//, '')}`);
  }
  return targets;
}

const OFF = ['0', 'false', 'off'];

function isOn(node: XmlNode | undefined): boolean {
  return node !== undefined && !OFF.includes(node.attrs['w:val'] ?? '');
}

function runFormat(properties: XmlNode | undefined): Omit<DocRun, 'text'> & { hidden: boolean } {
  const color = child(properties, 'w:color')?.attrs['w:val'] ?? '';
  const highlight = child(properties, 'w:highlight')?.attrs['w:val'] ?? 'none';
  const fill = (child(properties, 'w:shd')?.attrs['w:fill'] ?? 'auto').toUpperCase();
  const underline = child(properties, 'w:u')?.attrs['w:val'] ?? 'none';
  return {
    color: /^[0-9a-f]{6}$/i.test(color) ? color.toUpperCase() : null,
    highlight: highlight !== 'none' || !['AUTO', 'FFFFFF', ''].includes(fill),
    bold: isOn(child(properties, 'w:b')),
    underline: underline !== 'none',
    hidden: isOn(child(properties, 'w:vanish')),
  };
}

/** Pictures anywhere under `node`; `mc:Fallback` repeats the `mc:Choice` picture, so it is skipped. */
function collectImages(node: XmlNode, out: string[]): void {
  for (const item of node.children) {
    if (item.name === 'mc:Fallback') continue;
    if (item.name === 'a:blip' && item.attrs['r:embed']) out.push(item.attrs['r:embed']);
    else if (item.name === 'v:imagedata' && item.attrs['r:id']) out.push(item.attrs['r:id']);
    else collectImages(item, out);
  }
}

const RUN_CONTAINERS = new Set(['w:hyperlink', 'w:ins', 'w:smartTag', 'w:fldSimple', 'w:sdt', 'w:sdtContent', 'w:customXml', 'w:moveTo']);

function readRuns(node: XmlNode, runs: DocRun[], images: string[]): void {
  for (const item of node.children) {
    if (RUN_CONTAINERS.has(item.name)) {
      readRuns(item, runs, images);
      continue;
    }
    if (item.name !== 'w:r') continue;
    const { hidden, ...format } = runFormat(child(item, 'w:rPr'));
    let text = '';
    for (const part of item.children) {
      if (part.name === 'w:t') text += part.children.map((node) => node.text).join('');
      else if (part.name === 'w:tab') text += '\t';
      else if (part.name === 'w:br' || part.name === 'w:cr') text += '\n';
      else if (part.name === 'w:noBreakHyphen') text += '-';
      else if (['w:drawing', 'w:pict', 'w:object', 'mc:AlternateContent'].includes(part.name)) collectImages(part, images);
    }
    if (text && !hidden) runs.push({ text, ...format });
  }
}

/** Every paragraph of the body in reading order; table cells are read row by row, left to right. */
export function readDocxBlocks(parts: DocxParts): DocBlock[] {
  const numbering = readNumbering(parts.numbering);
  const relationships = readRelationships(parts.relationships);
  const body = find(parseXml(parts.document), 'w:body');
  const blocks: DocBlock[] = [];
  let rowCounter = 0;
  // Word counts each list (numId) on its own; a paragraph at one level restarts the deeper levels of that list.
  const counters = new Map<string, Map<number, number>>();

  const numberFor = (numId: string, levelText: string): DocNumbering => {
    const level = Number(levelText) || 0;
    const definition = numbering.get(numId)?.get(levelText) ?? { format: 'decimal', levelText: '', start: 1 };
    const list = counters.get(numId) ?? new Map<number, number>();
    counters.set(numId, list);
    for (const deeper of [...list.keys()]) if (deeper > level) list.delete(deeper);
    const value = (list.get(level) ?? definition.start - 1) + 1;
    list.set(level, value);
    return { format: definition.format, levelText: definition.levelText, value };
  };

  const paragraph = (node: XmlNode, tableRow: number | null) => {
    const runs: DocRun[] = [];
    const imageIds: string[] = [];
    readRuns(node, runs, imageIds);
    const numberProperties = child(child(node, 'w:pPr'), 'w:numPr');
    const numId = child(numberProperties, 'w:numId')?.attrs['w:val'];
    const level = child(numberProperties, 'w:ilvl')?.attrs['w:val'] ?? '0';
    blocks.push({
      runs,
      text: runs.map((run) => run.text).join(''),
      images: imageIds.map((id) => relationships.get(id)).filter((path): path is string => Boolean(path)),
      numbering: numId && numId !== '0' ? numberFor(numId, level) : null,
      tableRow,
    });
  };

  const walk = (node: XmlNode, tableRow: number | null) => {
    for (const item of node.children) {
      if (item.name === 'w:p') paragraph(item, tableRow);
      else if (item.name === 'w:tbl') {
        for (const row of children(item, 'w:tr')) {
          const current = rowCounter++;
          for (const cell of children(row, 'w:tc')) walk(cell, current);
        }
      } else if (['w:sdt', 'w:sdtContent', 'w:customXml'].includes(item.name)) walk(item, tableRow);
    }
  };
  if (body) walk(body, null);
  return blocks;
}
