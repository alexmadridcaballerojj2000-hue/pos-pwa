export type CodePage = 'CP437' | 'CP858' | 'CP1252';

export interface CodePageConfig {
  id: CodePage;
  escPosCode: number; // Argument 'n' for ESC t n
  name: string;
}

export const CODE_PAGES: Record<CodePage, CodePageConfig> = {
  CP437: {
    id: 'CP437',
    escPosCode: 0,
    name: 'USA / Standard Europe (CP437)',
  },
  CP858: {
    id: 'CP858',
    escPosCode: 19,
    name: 'Multilingual + Euro (CP858)',
  },
  CP1252: {
    id: 'CP1252',
    escPosCode: 16,
    name: 'Windows Latin 1 (CP1252)',
  },
};

/**
 * Byte lookup tables for Spanish and common extended Latin characters.
 * Values above 127 (0x7F) are mapped specifically per code page.
 * Standard ASCII (0x20..0x7E, \n, \r, \t) is identity.
 */
const CP437_MAP: Record<string, number> = {
  á: 0xa0,
  é: 0x82,
  í: 0xa1,
  ó: 0xa2,
  ú: 0xa3,
  Á: 0x41, // 'A' fallback in CP437
  É: 0x90,
  Í: 0x49, // 'I' fallback
  Ó: 0x4f, // 'O' fallback
  Ú: 0x55, // 'U' fallback
  ñ: 0xa4,
  Ñ: 0xa5,
  ü: 0x81,
  Ü: 0x9a,
  '¿': 0xa8,
  '¡': 0xad,
  º: 0xa7,
  ª: 0xa6,
};

const CP858_MAP: Record<string, number> = {
  á: 0xa0,
  é: 0x82,
  í: 0xa1,
  ó: 0xa2,
  ú: 0xa3,
  Á: 0xb5,
  É: 0x90,
  Í: 0xd6,
  Ó: 0xe0,
  Ú: 0xe9,
  ñ: 0xa4,
  Ñ: 0xa5,
  ü: 0x81,
  Ü: 0x9a,
  '¿': 0xa8,
  '¡': 0xad,
  '€': 0xd5,
  º: 0xa7,
  ª: 0xa6,
};

const CP1252_MAP: Record<string, number> = {
  á: 0xe1,
  é: 0xe9,
  í: 0xed,
  ó: 0xf3,
  ú: 0xfa,
  Á: 0xc1,
  É: 0xc9,
  Í: 0xcd,
  Ó: 0xd3,
  Ú: 0xda,
  ñ: 0xf1,
  Ñ: 0xd1,
  ü: 0xfc,
  Ü: 0xdc,
  '¿': 0xbf,
  '¡': 0xa1,
  '€': 0x80,
  º: 0xba,
  ª: 0xaa,
};

const ASCII_FALLBACKS: Record<string, string> = {
  á: 'a',
  é: 'e',
  í: 'i',
  ó: 'o',
  ú: 'u',
  Á: 'A',
  É: 'E',
  Í: 'I',
  Ó: 'O',
  Ú: 'U',
  ñ: 'n',
  Ñ: 'N',
  ü: 'u',
  Ü: 'U',
  '¿': '?',
  '¡': '!',
  '€': 'EUR',
};

/**
 * Encodes a JavaScript unicode string to a Uint8Array using the specified code page.
 * Unmapped characters are replaced with ASCII approximations or '?' (0x3F).
 */
export function encodeString(text: string, codePage: CodePage = 'CP858'): Uint8Array {
  const map = codePage === 'CP858' ? CP858_MAP : codePage === 'CP1252' ? CP1252_MAP : CP437_MAP;

  const bytes: number[] = [];

  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    const code = char.charCodeAt(0);

    // ASCII printable + control chars (\n, \r, \t)
    if (code >= 0x20 && code <= 0x7e) {
      bytes.push(code);
    } else if (code === 0x0a || code === 0x0d || code === 0x09) {
      bytes.push(code);
    } else if (map[char] !== undefined) {
      bytes.push(map[char]!);
    } else if (ASCII_FALLBACKS[char] !== undefined) {
      const fallback = ASCII_FALLBACKS[char]!;
      for (let j = 0; j < fallback.length; j++) {
        bytes.push(fallback.charCodeAt(j));
      }
    } else {
      // Unknown character fallback: '?'
      bytes.push(0x3f);
    }
  }

  return new Uint8Array(bytes);
}
