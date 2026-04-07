/**
 * upload.service.js — رفع الملفات إلى Supabase Storage
 */

import { sb }    from '../core/supabase.js';
import { getExt, isAllowedFile, formatFileSize, uid } from '../core/utils.js';

const BUCKET  = 'order-files';
const MAX_MB  = 50;
const MAX_B   = MAX_MB * 1024 * 1024;

// ══════════════════════════════════════
//  رفع ملف واحد
// ══════════════════════════════════════
/**
 * @param {File}   file
 * @param {string} userId
 * @param {Function} [onProgress]  — (percent: number) => void
 * @returns {Promise<string>} publicUrl
 */
export async function uploadFile(file, userId, onProgress) {

  // ── التحقق ────────────────────────────────────
  if (!isAllowedFile(file)) {
    throw new Error(`نوع الملف غير مدعوم: .${getExt(file.name)}`);
  }
  if (file.size > MAX_B) {
    throw new Error(`حجم الملف يتجاوز ${MAX_MB}MB (الحجم: ${formatFileSize(file.size)})`);
  }

  // ── التحقق من Magic Bytes ─────────────────────
  await _validateMagicBytes(file);

  // ── المسار في Storage ────────────────────────
  const ext  = getExt(file.name);
  const path = `${userId}/${Date.now()}_${uid()}.${ext}`;

  // ── الرفع ────────────────────────────────────
  const { error } = await sb.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert:       false,
    });

  if (error) throw new Error('فشل رفع الملف: ' + error.message);

  // ── الرابط العام ─────────────────────────────
  const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
  onProgress?.(100);

  return data.publicUrl;
}

// ══════════════════════════════════════
//  حذف ملف من Storage
// ══════════════════════════════════════
export async function deleteFile(publicUrl) {
  try {
    // استخراج المسار من الرابط
    const url  = new URL(publicUrl);
    const path = url.pathname.split(`/${BUCKET}/`)[1];
    if (!path) return;
    await sb.storage.from(BUCKET).remove([path]);
  } catch (e) {
    console.warn('[upload] فشل حذف الملف:', e.message);
  }
}

// ══════════════════════════════════════
//  التحقق من Magic Bytes
// ══════════════════════════════════════
const MAGIC = {
  pdf:  [[0x25, 0x50, 0x44, 0x46]],                        // %PDF
  docx: [[0x50, 0x4B, 0x03, 0x04]],                        // PK (ZIP)
  pptx: [[0x50, 0x4B, 0x03, 0x04]],
  xlsx: [[0x50, 0x4B, 0x03, 0x04]],
  doc:  [[0xD0, 0xCF, 0x11, 0xE0]],                        // OLE2
  jpg:  [[0xFF, 0xD8, 0xFF]],
  jpeg: [[0xFF, 0xD8, 0xFF]],
  png:  [[0x89, 0x50, 0x4E, 0x47]],
};

async function _validateMagicBytes(file) {
  const ext       = getExt(file.name);
  const expected  = MAGIC[ext];
  if (!expected)  return; // لا يوجد قاعدة لهذا النوع

  const buf  = await file.slice(0, 8).arrayBuffer();
  const view = new Uint8Array(buf);

  const valid = expected.some(sig =>
    sig.every((byte, i) => view[i] === byte)
  );

  if (!valid) throw new Error(`محتوى الملف لا يطابق امتداده (.${ext}) — ملف مشبوه`);
}
