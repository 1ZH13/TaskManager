const previewPdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>
endobj
trailer
<< /Root 1 0 R >>
%%EOF`;

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name') ?? 'documento.pdf';
  const download = searchParams.get('download') === '1';
  return new Response(previewPdf, {
    headers: {
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${name.replaceAll('"', '')}"`,
      'Content-Type': 'application/pdf',
    },
  });
}
