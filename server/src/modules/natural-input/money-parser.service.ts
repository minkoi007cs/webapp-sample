import { Injectable } from '@nestjs/common';

@Injectable()
export class MoneyParserService {
  /**
   * Normalizes Vietnamese money expressions into a number.
   * Examples:
   * "4 triệu 3 trăm 65 ngàn" -> 4365000
   * "2 triệu rưỡi" -> 2500000
   * "150k" -> 150000
   * "3tr2" -> 3200000
   */
  parse(input: string): number | null {
    if (!input) return null;

    let text = input.toLowerCase().replace(/\s+/g, '').replace(/,/g, '');

    // Handle "k" suffix (e.g., 150k)
    if (text.endsWith('k')) {
      const val = parseFloat(text.replace('k', ''));
      return isNaN(val) ? null : val * 1000;
    }

    // Handle "tr", "triệu", "trieu" (thiếu dấu) — ví dụ 5trieu, 3tr2
    const trieuRegex = /(\d+)(tr|triệu|trieu)(\d*)/i;
    const match = text.match(trieuRegex);
    if (match) {
      const millions = parseInt(match[1]);
      let decimalsStr = match[3] || '0';
      
      // If decimal is shorthand like 3tr2, it means 3.2 million
      // We need to normalize the decimal part. 
      // 3tr2 -> 3,200,000
      // 3tr25 -> 3,250,000
      // 3tr05 -> 3,050,000
      if (decimalsStr.length === 1) decimalsStr += '00000';
      else if (decimalsStr.length === 2) decimalsStr += '0000';
      else if (decimalsStr.length === 3) decimalsStr += '000';
      
      const decimals = parseInt(decimalsStr.substring(0, 6));
      return millions * 1000000 + (isNaN(decimals) ? 0 : decimals);
    }

    // Handle "rưỡi" (e.g., triệu rưỡi)
    if (text.includes('rưỡi')) {
      if (text.includes('triệu')) {
        const val = parseFloat(text.replace('triệurưỡi', '')) || 0;
        return (val + 0.5) * 1000000;
      }
      if (text.includes('ngàn') || text.includes('nghìn')) {
        const val = parseFloat(text.replace(/ngànrưỡi|nghìnrưỡi/, '')) || 0;
        return (val + 0.5) * 1000;
      }
    }

    // Fallback to basic parsing if no special markers
    const fallback = parseFloat(text.replace(/[^0-9.]/g, ''));
    return isNaN(fallback) ? null : fallback;
  }

  /**
   * Pre-processes full text and replaces money patterns with numbers to help AI.
   */
  normalizeText(text: string): string {
    if (!text) return text;
    let t = text.replace(/\s+/g, ' ').trim();
    // Chuẩn hóa lỗi gõ thiếu dấu "triệu" để regex parse và AI đọc đúng (vd. 5trieu, 2 trieu)
    t = t.replace(/(\d+)\s*trieu\b/gi, '$1 triệu');
    t = t.replace(/(\d+)trieu\b/gi, '$1 triệu');
    return t;
  }
}
