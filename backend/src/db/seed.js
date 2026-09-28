import '../env.js';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import bcrypt from 'bcryptjs';
import { pool, query, one } from '../db.js';
import { initSchema } from './init.js';
import { computeChainHash, sha256Buffer, GENESIS_HASH } from '../lib/hash.js';
import { UPLOAD_ROOT } from '../config.js';

const FORCE = process.argv.includes('--force');
const PASSWORD = 'SecureDms@2026';

const USERS = [
  { name: 'Rohan Mehta', email: 'admin@secure-dms.gov.in', role: 'admin', department: 'Cyber Crime Unit', badge: 'ADM-1001', color: '#2f49d6' },
  { name: 'Ananya Iyer', email: 'investigator@secure-dms.gov.in', role: 'investigator', department: 'Economic Offences Wing', badge: 'INV-2047', color: '#0f766e' },
  { name: 'Vikram Singh', email: 'analyst@secure-dms.gov.in', role: 'analyst', department: 'Forensic Analysis Lab', badge: 'ANL-3312', color: '#7c3aed' },
  { name: 'Fatima Khan', email: 'prosecutor@secure-dms.gov.in', role: 'prosecutor', department: 'State Prosecution', badge: 'PRC-4408', color: '#b45309' },
];

const CASES = [
  { number: 'CASE-2026-00001', title: 'UPI Phishing Ring - Vishing Network', type: 'cyber', status: 'active', priority: 'critical', agency: 'Cyber Crime Unit', court: 'Sessions Court, Mumbai', filing: '2026-01-14', desc: 'Organised vishing cartel defrauding account holders through spoofed bank helplines across three states.' },
  { number: 'CASE-2026-00002', title: 'Bank Locker Theft - Andheri Branch', type: 'criminal', status: 'under_review', priority: 'high', agency: 'Economic Offences Wing', court: 'Chief Metropolitan Magistrate', filing: '2026-02-03', desc: 'Forced entry into three lockers during a power outage; inner cash trays missing.' },
  { number: 'CASE-2026-00003', title: 'Narcotics Seizure - NH44 Checkpost', type: 'narcotics', status: 'active', priority: 'high', agency: 'Anti Narcotics Cell', court: 'NDPS Special Court', filing: '2026-03-21', desc: '2.4 kg contraband concealed in a modified fuel tank during a night interception.' },
  { number: 'CASE-2026-00004', title: 'Land Record Forgery - Survey No. 14/2', type: 'corruption', status: 'open', priority: 'medium', agency: 'Vigilance Department', court: 'District Court', filing: '2026-04-09', desc: 'Duplicate mutation entries created to transfer agricultural land belonging to a retired soldier.' },
  { number: 'CASE-2026-00005', title: 'Ponzi Collection Drive - Marathwada', type: 'financial', status: 'active', priority: 'high', agency: 'Economic Offences Wing', court: 'Sessions Court', filing: '2026-05-30', desc: 'Unregistered deposit scheme collecting funds from 900+ investors with promised 40% returns.' },
  { number: 'CASE-2026-00006', title: 'Missing Person Enquiry - Kanpur Cantt', type: 'criminal', status: 'closed', priority: 'medium', agency: 'Local Police Station', court: '-', filing: '2026-06-18', desc: 'Individual located at relative\'s residence; enquiry closed after statements were recorded.' },
];

/* ------------------------------------------------------------------ *
 * Sample file builders — produce real, openable bytes                *
 * ------------------------------------------------------------------ */

function makePdf(title, body) {
  const clean = (s) => String(s).replace(/[^\x20-\x7E]/g, '-');
  const esc = (s) => clean(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

  const lines = [title, '', ...body];
  let stream = 'BT /F1 11 Tf 56 786 Td 15 TL\n';
  for (const line of lines) stream += `(${esc(line.slice(0, 92))}) Tj T*\n`;
  stream += 'ET';

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((body, i) => {
    offsets[i] = pdf.length;
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((off) => {
    pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
}

const pdf = (lines) => ({
  buf: makePdf(lines[0], lines.slice(1)),
  ext: '.pdf',
  mime: 'application/pdf',
});
const txt = (lines) => ({
  buf: Buffer.from(lines.join('\r\n'), 'utf8'),
  ext: '.txt',
  mime: 'text/plain',
});
const csv = (lines) => ({
  buf: Buffer.from(lines.join('\r\n'), 'utf8'),
  ext: '.csv',
  mime: 'text/csv',
});

const SEED_DOCUMENTS = [
  { case: 'CASE-2026-00001', type: 'evidence', title: 'Call detail records - suspect handset', desc: 'CDR extract for the primary suspect covering 60 days of activity with cell tower coordinates.', tags: ['cdr', 'telephony', 'prime'], conf: 'restricted', by: 1, content: () => txt(['CALL DETAIL RECORDS - EXTRACT', 'IMSI: 404-92-XXXXXX   MSISDN: +91-98XXXXXX21', 'Window: 2026-01-01 to 2026-02-28', 'Total events: 4,182 | Outgoing: 2,104 | Incoming: 2,078', 'Frequent contacts: 12 numbers across 3 circles', 'NOTICE: Handling chain per Exhibit Rules 2026.']) },
  { case: 'CASE-2026-00001', type: 'evidence', title: 'Screenshot bundle - spoofed helpline pages', desc: 'Twelve screenshots of spoofed banking landing pages captured with hash manifest.', tags: ['screenshot', 'phishing'], conf: 'confidential', by: 2, content: () => txt(['SCREENSHOT MANIFEST', 'sha256 index maintained separately', 'Captured: 2026-01-18 09:12 IST', 'Source: complainant device (sealed)']) },
  { case: 'CASE-2026-00001', type: 'statement', title: 'Statement of complainant - S. Deshmukh', desc: 'Recorded statement detailing the transaction trail of the defrauded amount.', tags: ['statement', '161'], conf: 'internal', by: 1, content: () => pdf(['RECORDED STATEMENT u/s 161 CrPC', 'Complainant: S. Deshmukh', 'Amount defrauded: INR 4,72,000', 'Statement recorded on 2026-01-19', 'Witness: PSI K. More', 'Signature obtained.']) },
  { case: 'CASE-2026-00002', type: 'photo', title: 'Locker room photographs - forced entry', desc: 'Forensic photographs of tamper marks on lockers 214, 218 and 222 with scale markers.', tags: ['photograph', 'forensic'], conf: 'restricted', by: 2, content: () => txt(['FORENSIC PHOTOGRAPH LOG', 'Scene: Andheri branch, locker room', 'Frames: 18 (with scale)', 'Photographer: FSL Team 2', 'Lighting: oblique, UV pass included']) },
  { case: 'CASE-2026-00002', type: 'report', title: 'FSL report - tool mark analysis', desc: 'Forensic Science Laboratory opinion on tool marks recovered from the locker door.', tags: ['fsl', 'toolmark'], conf: 'confidential', by: 3, content: () => pdf(['FSL OPINION - TOOL MARK ANALYSIS', 'Lab ref: FSL/MUM/2026/0442', 'Marks consistent with a hollow implement', 'No trace DNA recovered', 'Opinion issued: 2026-02-27', 'Scientific Officer']) },
  { case: 'CASE-2026-00003', type: 'evidence', title: 'Interception memo and seizure panchnama', desc: 'Panchnama prepared at the checkpost with two independent witnesses and weighed contraband.', tags: ['panchnama', 'ndps'], conf: 'restricted', by: 1, content: () => pdf(['PANCHNAMA - SEIZURE MEMORANDUM', 'Place: NH44 checkpost, km 212', 'Vehicle: MH-XX-4471', 'Seizure: 2.4 kg contraband', 'Witnesses: 2 panch', 'Sealing done in presence of SDM']) },
  { case: 'CASE-2026-00003', type: 'video', title: 'Dashcam footage - night interception', desc: 'Unedited dashcam capture of the vehicle stop and search, hash logged at capture time.', tags: ['video', 'dashcam'], conf: 'restricted', by: 2, content: () => txt(['MEDIA PLACEHOLDER - DASHCAM EXPORT', 'Container: MP4 / H.264', 'Duration: 00:14:38', 'Captured: 2026-03-21 01:47 IST', 'Original retained on write-once media.']) },
  { case: 'CASE-2026-00004', type: 'legal_filing', title: 'Mutation entries - certified copy', desc: 'Certified copy of the disputed mutation entries obtained from the Taluka office.', tags: ['land', 'certified'], conf: 'internal', by: 3, content: () => pdf(['CERTIFIED COPY - MUTATION ENTRY', 'Survey No. 14/2', 'Entries 7 through 11 disputed', 'Certified by Talathi', 'Issued: 2026-04-11']) },
  { case: 'CASE-2026-00004', type: 'report', title: 'Handwriting comparison - questioned signatures', desc: 'Questioned document examination comparing disputed signatures against known specimens.', tags: ['handwriting', 'qde'], conf: 'confidential', by: 3, content: () => pdf(['QUESTIONED DOCUMENT EXAMINATION', 'Questioned: 4 signatures', 'Specimens: 12 known', 'Opinion: Not written by the same hand', 'Examiner: QDE Division']) },
  { case: 'CASE-2026-00005', type: 'evidence', title: 'Investor ledger extract - 900 accounts', desc: 'Spreadsheet extract of depositors, amounts and payout promises from the seized ledger.', tags: ['ledger', 'finance'], conf: 'confidential', by: 2, content: () => csv(['investor_id,name,amount_inr,promised_return_pct,payout_date', 'INV-001,R. Patil,150000,40,2026-07-01', 'INV-002,S. Jadhav,250000,40,2026-07-01', 'INV-003,A. Shaikh,75000,40,2026-07-01', 'INV-004,M. Kulkarni,500000,40,2026-07-01', 'INV-005,D. Pawar,120000,40,2026-07-01']) },
  { case: 'CASE-2026-00005', type: 'correspondence', title: 'Notices issued to promoter entities', desc: 'Statutory notices served on the promoter and two related entities with acknowledgement.', tags: ['notice', 'statutory'], conf: 'internal', by: 1, content: () => pdf(['STATUTORY NOTICE', 'To: M/s Skyline Collectives Pvt Ltd', 'Subject: Unlawful deposit collection', 'Reply within 15 days', 'Issued under Sec. 108']) },
  { case: 'CASE-2026-00006', type: 'statement', title: 'Closure statement - family members', desc: 'Statements of family members recorded at the time of locating the individual.', tags: ['closure'], conf: 'internal', by: 1, content: () => pdf(['CLOSURE STATEMENT', 'Statements recorded 2026-06-20', 'Individual located safely', 'No offence made out', 'SHO, Kanpur Cantt']) },
  { case: null, type: 'legal_filing', title: 'Standard operating procedure - evidence intake', desc: 'Department-wide SOP governing intake, sealing, hashing and transfer of digital evidence.', tags: ['sop', 'policy'], conf: 'public', by: 3, content: () => pdf(['SOP - DIGITAL EVIDENCE INTAKE', 'Section 1: Sealing and labelling', 'Section 2: Hashing at intake', 'Section 3: Chain of custody forms', 'Section 4: Retrieval and disposal']) },
  { case: null, type: 'court_order', title: 'Standing order - digital exhibit handling', desc: 'Standing order prescribing handling protocol for digital exhibits in trial proceedings.', tags: ['order', 'court'], conf: 'public', by: 3, content: () => pdf(['STANDING ORDER', 'Digital exhibits shall be produced with hash certificates', 'Copies to be supplied to both sides', 'Originals retained under seal']) },
];

export async function seed() {
  await initSchema();

  const alreadySeeded = await one('SELECT COUNT(*)::int AS n FROM documents');
  if (alreadySeeded.n > 0 && !FORCE) {
    console.log('Database already has documents — skipping seed. Use --force to wipe and re-seed.');
    return;
  }

  if (FORCE) {
    const files = await query('SELECT storage_path FROM documents');
    await query('DELETE FROM documents');
    await query('DELETE FROM cases');
    await query('DELETE FROM audit_logs');
    await query("SELECT setval('seq_case_number', 1, false), setval('seq_document_number', 1, false)");
    files.rows.forEach((f) => {
      if (f.storage_path) {
        fs.promises.unlink(path.join(UPLOAD_ROOT, path.basename(f.storage_path))).catch(() => {});
      }
    });
    console.log('Wiped existing seed data.');
  }

  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // --- users ---
  const userIds = {};
  for (const u of USERS) {
    const row = await one(
      `INSERT INTO users (name, email, password_hash, role, department, badge_id, avatar_color)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, department = EXCLUDED.department
       RETURNING id`,
      [u.name, u.email, passwordHash, u.role, u.department, u.badge, u.color]
    );
    userIds[u.email] = row.id;
  }
  const admin = userIds[USERS[0].email];

  // --- cases ---
  const caseIds = {};
  for (const c of CASES) {
    const row = await one(
      `INSERT INTO cases (case_number, title, description, case_type, status, priority,
                          lead_officer_id, agency, court, filing_date, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (case_number) DO UPDATE SET status = EXCLUDED.status
       RETURNING id`,
      [c.number, c.title, c.desc, c.type, c.status, c.priority,
       userIds[USERS[1].email], c.agency, c.court, c.filing, admin]
    );
    caseIds[c.number] = row.id;
  }
  // Keep generated case numbers ahead of the seeded ones.
  await query(`SELECT setval('seq_case_number', $1, true)`, [CASES.length]);

  // --- documents, in insertion order so the hash chain links correctly ---
  let prevChain = GENESIS_HASH;

  for (let i = 0; i < SEED_DOCUMENTS.length; i += 1) {
    const spec = SEED_DOCUMENTS[i];
    const n = i + 1;
    const docNumber = `EVD-2026-${String(n).padStart(5, '0')}`;
    const { buf, ext, mime } = spec.content();

    const fileName = `seed-${Date.now().toString(36)}-${n}${ext}`;
    fs.writeFileSync(path.join(UPLOAD_ROOT, fileName), buf);

    const contentHash = sha256Buffer(buf);
    const chain = computeChainHash(prevChain, contentHash, docNumber);
    const thisPrev = prevChain;
    prevChain = chain;

    const daysAgo = Math.min(SEED_DOCUMENTS.length - i, 90);
    const uploader = [admin, userIds[USERS[1].email], userIds[USERS[2].email]][spec.by % 3];

    const inserted = await one(
      `INSERT INTO documents (doc_number, title, description, doc_type, category, case_id,
                              file_name, original_name, mime_type, size_bytes, storage_path,
                              hash_sha256, prev_hash, chain_hash, status, confidentiality, tags,
                              uploaded_by, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
               NOW() - ($18::int * INTERVAL '1 day'), NOW() - ($18::int * INTERVAL '1 day'))
       RETURNING id`,
      [
        docNumber, spec.title, spec.desc, spec.type,
        spec.case ? caseIds[spec.case] : null,
        fileName, `${spec.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 42)}${ext}`,
        mime, buf.length, fileName,
        contentHash, thisPrev, chain,
        i % 4 === 3 ? 'pending_review' : 'verified',
        spec.conf, spec.tags, uploader, daysAgo,
      ]
    );

    await query(
      `INSERT INTO document_versions (document_id, version_number, file_name, original_name,
                                      mime_type, size_bytes, storage_path, hash_sha256, note,
                                      created_by, created_at)
       VALUES ($1, 1, $2, $3, $4, $5, $6, $7, 'Initial upload', $8,
               NOW() - ($9::int * INTERVAL '1 day'))`,
      [inserted.id, fileName, fileName, mime, buf.length, fileName, contentHash, uploader, daysAgo]
    );

    await query(
      `INSERT INTO chain_of_custody (document_id, action, from_user, notes, hash_proof, created_at)
       VALUES ($1, 'collected', $2, $3, $4, NOW() - ($5::int * INTERVAL '1 day'))`,
      [inserted.id, uploader, 'Registered into the secure repository', chain, daysAgo]
    );
  }
  await query(`SELECT setval('seq_document_number', $1, true)`, [SEED_DOCUMENTS.length]);

  // --- shares ---
  await query(
    `INSERT INTO shares (document_id, shared_by, shared_with, email, permission, message)
     SELECT d.id, $1, $2, $3, 'download', 'Please review before the next hearing.'
     FROM documents d WHERE d.case_id = $4 ORDER BY d.id LIMIT 2`,
    [admin, userIds[USERS[2].email], USERS[2].email, caseIds['CASE-2026-00001']]
  );

  // --- audit trail ---
  const auditSeed = [
    ['LOGIN', 'user', admin, 'Rohan Mehta', 1],
    ['CASE_CREATED', 'case', caseIds['CASE-2026-00001'], 'UPI Phishing Ring - Vishing Network', 6],
    ['DOCUMENT_UPLOADED', 'document', null, 'Call detail records - suspect handset', 12],
    ['DOCUMENT_VERIFIED', 'document', null, 'FSL report - tool mark analysis', 30],
    ['DOCUMENT_SHARED', 'share', null, 'analyst@secure-dms.gov.in', 46],
    ['PROFILE_UPDATED', 'user', userIds[USERS[1].email], 'Ananya Iyer', 70],
  ];
  for (const [action, entityType, entityId, entityName, hoursAgo] of auditSeed) {
    await query(
      `INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, entity_name,
                               details, ip_address, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'127.0.0.1', NOW() - ($8::int * INTERVAL '1 hour'))`,
      [
        admin, 'Rohan Mehta', action, entityType,
        entityId != null ? String(entityId) : null, entityName,
        JSON.stringify({ source: 'seed' }), hoursAgo,
      ]
    );
  }

  console.log('Seed complete.');
  console.log(`  users:     ${USERS.length}`);
  console.log(`  cases:     ${CASES.length}`);
  console.log(`  documents: ${SEED_DOCUMENTS.length}`);
  console.log('');
  console.log(`Sign in with any of these (password: ${PASSWORD}):`);
  USERS.forEach((u) => console.log(`  - ${u.email}`));
}

// Only run when executed directly (`node src/db/seed.js`), never on import —
// the server may import seed() to populate an empty production database.
const isCli =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isCli) {
  try {
    await seed();
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
