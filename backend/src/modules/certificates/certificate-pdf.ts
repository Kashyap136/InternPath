import PDFDocument from 'pdfkit';
import path from 'node:path';

export interface CertificatePdfData {
  certificateNumber: string;
  type: 'COMPLETION' | 'APPRECIATION';
  status: 'VALID' | 'REVOKED';
  recipientName: string;
  programTitle: string;
  domainName: string;
  projectTitle: string | null;
  projectSourceType: string | null;
  internshipStart: Date;
  internshipCompletion: Date | null;
  issuedAt: Date;
  issuerName: string;
  issuerRole: string;
  /** Absolute public verification link printed on the document. */
  verifyUrl: string;
}

const IVORY = '#F7F4EE';
const INK = '#292C2A';
const FOREST = '#315F50';
const DEEP_GREEN = '#23483D';
const SECONDARY = '#6B6A66';

const formatDate = (date: Date): string =>
  date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

const SOURCE_LABELS: Record<string, string> = {
  MENTOR_CREATED: 'Mentor-created project',
  SIMULATED: 'Simulated industry project',
  OPEN_SOURCE: 'Open-source contribution project',
  COMMUNITY: 'Community project',
  CLIENT: 'Client project',
};

export function renderCertificatePdf(data: CertificatePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // A4 landscape
    const doc = new PDFDocument({ layout: 'landscape', size: 'A4', margin: 0, info: {
      Title: `InternPath ${data.type === 'COMPLETION' ? 'Certificate of Completion' : 'Certificate of Appreciation'} — ${data.certificateNumber}`,
      Author: 'InternPath',
    } });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width;
    const H = doc.page.height;

    // Warm ivory background
    doc.rect(0, 0, W, H).fill(IVORY);

    // Double frame: outer forest rule + inner hairline
    doc.rect(24, 24, W - 48, H - 48).lineWidth(3).strokeColor(FOREST).stroke();
    doc.rect(32, 32, W - 64, H - 64).lineWidth(0.75).strokeColor('#B9B1A8').stroke();

    // Gold accent rules top & bottom inside the frame
    doc.moveTo(W / 2 - 120, 56).lineTo(W / 2 + 120, 56).lineWidth(1.5).strokeColor('#D6B15E').stroke();
    doc.moveTo(W / 2 - 120, H - 56).lineTo(W / 2 + 120, H - 56).lineWidth(1.5).strokeColor('#D6B15E').stroke();

    // Official logo mark (top centre) — owner-supplied asset, undistorted
    try {
      // Resolved from this module (backend/{src|dist}/modules/certificates),
      // not process.cwd(): hosted starts run from the repository root.
      const logoPath = path.resolve(__dirname, '../../../src/modules/certificates/assets/logo-mark.png');
      doc.image(logoPath, W / 2 - 34, 62, { width: 68, height: 68, align: 'center' });
    } catch {
      // The document remains valid without the mark if the asset is unavailable.
    }

    let y = 148;

    // Title
    doc.font('Helvetica-Bold').fontSize(26).fillColor(DEEP_GREEN)
      .text(data.type === 'COMPLETION' ? 'Certificate of Completion' : 'Certificate of Appreciation', 0, y, { width: W, align: 'center' });
    y += 34;
    doc.font('Helvetica').fontSize(10.5).fillColor(SECONDARY)
      .text('InternPath — Project-Based Internships', 0, y, { width: W, align: 'center' });
    y += 30;

    // Award line
    doc.font('Helvetica').fontSize(11).fillColor(INK)
      .text('This certificate is presented to', 0, y, { width: W, align: 'center' });
    y += 26;

    // Recipient
    doc.font('Helvetica-Bold').fontSize(24).fillColor(INK)
      .text(data.recipientName, 0, y, { width: W, align: 'center' });
    y += 16;
    doc.moveTo(W / 2 - 180, y).lineTo(W / 2 + 180, y).lineWidth(1).strokeColor('#B9B1A8').stroke();
    y += 18;

    // Body
    const programLine =
      data.type === 'APPRECIATION'
        ? `in recognition of outstanding performance in the project-based internship "${data.programTitle}"`
        : `for successfully completing the project-based internship "${data.programTitle}"`;
    doc.font('Helvetica').fontSize(11.5).fillColor(INK)
      .text(programLine, 72, y, { width: W - 144, align: 'center' });
    y += 18;
    const domainLine = `in the domain of ${data.domainName}` +
      (data.projectTitle ? `, completing the project "${data.projectTitle}"` : '') +
      (data.projectSourceType ? ` (${SOURCE_LABELS[data.projectSourceType] ?? data.projectSourceType})` : '') + '.';
    doc.font('Helvetica').fontSize(11.5).fillColor(INK)
      .text(domainLine, 72, y, { width: W - 144, align: 'center' });
    y += 22;

    const periodLine = `Internship period: ${formatDate(data.internshipStart)}` +
      (data.internshipCompletion ? ` — completed ${formatDate(data.internshipCompletion)}` : '') +
      ` · Issued ${formatDate(data.issuedAt)}`;
    doc.font('Helvetica').fontSize(10.5).fillColor(SECONDARY)
      .text(periodLine, 0, y, { width: W, align: 'center' });
    y += 34;

    // Approval representation — typed issuer line (no signature images)
    doc.font('Helvetica-Bold').fontSize(11).fillColor(DEEP_GREEN)
      .text(data.issuerName, W - 300, y, { width: 250, align: 'center' });
    doc.font('Helvetica').fontSize(9.5).fillColor(SECONDARY)
      .text(`${data.issuerRole}, InternPath`, W - 300, y + 14, { width: 250, align: 'center' });

    // Certificate number + verification footer (left block)
    doc.font('Helvetica-Bold').fontSize(10).fillColor(FOREST)
      .text(`Certificate No. ${data.certificateNumber}`, 60, y, { width: 280, align: 'center' });
    doc.font('Helvetica').fontSize(8.5).fillColor(SECONDARY)
      .text('Verify this certificate at:', 60, y + 14, { width: 280, align: 'center' });
    doc.font('Helvetica').fontSize(8.5).fillColor(FOREST)
      .text(data.verifyUrl, 60, y + 26, { width: 280, align: 'center', link: data.verifyUrl, underline: true });

    // Honest scope statement (bottom centre)
    doc.font('Helvetica-Oblique').fontSize(8).fillColor(SECONDARY)
      .text(
        'This certificate records completion of the internship described above on the InternPath platform. It is not an academic qualification, professional accreditation or employment verification.',
        100, H - 78, { width: W - 200, align: 'center' }
      );

    // Revocation watermark (applies to re-issued prints of revoked records)
    if (data.status === 'REVOKED') {
      doc.save();
      doc.rotate(-18, { origin: [W / 2, H / 2] }); // PDFKit takes degrees
      doc.font('Helvetica-Bold').fontSize(64).fillColor('#702F45', 0.14)
        .text('REVOKED', 0, H / 2 - 40, { width: W, align: 'center' });
      doc.restore();
    }

    doc.end();
  });
}
