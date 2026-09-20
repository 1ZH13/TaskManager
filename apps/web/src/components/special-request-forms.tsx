'use client';

import { useState, type FormEvent } from 'react';
import { appointmentRequestSchema, invoiceSubmissionSchema } from '@task-manager/shared';
import { Button } from '../../../../packages/ui/src/index';
import { useDemo } from './demo-context';

type Status = { kind: 'success' | 'error'; message: string } | null;

function Notice({ status }: { status: Status }) {
  return status ? <p role={status.kind === 'error' ? 'alert' : 'status'} className={status.kind === 'error' ? 'inline-error' : 'success-notice'}>{status.message}</p> : null;
}

export function AppointmentRequestForm() {
  const { phName, phId, repository } = useDemo(); const [status, setStatus] = useState<Status>(null); const [sending, setSending] = useState(false);
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = event.currentTarget; const values = Object.fromEntries(new FormData(form)); const result = appointmentRequestSchema.safeParse(values); if (!result.success) { setStatus({ kind: 'error', message: result.error.issues[0]?.message ?? 'Revisa los datos de la cita.' }); return; } setSending(true); void repository.submitAppointment(phId, result.data).then(() => { setStatus({ kind: 'success', message: `Solicitud enviada para ${result.data.date} a las ${result.data.time}. Administración confirmará la disponibilidad.` }); form.reset(); }).catch((error: { message?: string }) => setStatus({ kind: 'error', message: error.message ?? 'No fue posible enviar la solicitud.' })).finally(() => setSending(false)); };
  return <section className="workspace-page"><p className="eyebrow">{phName}</p><h1>Solicitar cita con administración</h1><p>Esta ruta es compartible dentro de tu PH. La disponibilidad final será confirmada por administración.</p><form className="entity-form" onSubmit={submit} noValidate><label>RUC<input name="ruc" required minLength={3} /></label><label>Dígito verificador<input name="dv" required /></label><label>Persona que asistirá<input name="attendeeName" required /></label><label>Día<input name="date" type="date" required /></label><label>Hora<input name="time" type="time" required /></label><Button disabled={sending}>{sending ? 'Enviando…' : 'Solicitar cita'}</Button></form><Notice status={status} /></section>;
}

export function InvoiceSubmissionForm() {
  const { phName, phId, repository } = useDemo(); const [status, setStatus] = useState<Status>(null); const [sending, setSending] = useState(false); const [fileName, setFileName] = useState('');
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = event.currentTarget; const values = Object.fromEntries(new FormData(form)); const result = invoiceSubmissionSchema.safeParse({ ...values, documentUrl: fileName ? `https://demo.local/facturas/${encodeURIComponent(fileName)}` : '' }); if (!result.success) { setStatus({ kind: 'error', message: result.error.issues[0]?.message ?? 'Revisa los importes y adjunta la factura.' }); return; } setSending(true); void repository.submitInvoice({ phId, ...result.data }).then(() => { setStatus({ kind: 'success', message: `Factura enviada. Total simulado: B/. ${result.data.total.toFixed(2)} (ITBMS: B/. ${result.data.tax.toFixed(2)}).` }); form.reset(); setFileName(''); }).catch((error: { message?: string }) => setStatus({ kind: 'error', message: error.message ?? 'No fue posible enviar la factura.' })).finally(() => setSending(false)); };
  return <section className="workspace-page"><p className="eyebrow">{phName}</p><h1>Enviar factura</h1><p>Adjunta una representación fiscal. La tasa se mantiene configurable hasta que se definan las reglas tributarias finales.</p><form className="entity-form" onSubmit={submit} noValidate><label>Nombre de factura<input name="invoiceName" required minLength={3} /></label><label>Archivo fiscal<input aria-label="Adjuntar factura fiscal" type="file" accept="application/pdf,image/*" required onChange={(event) => setFileName(event.currentTarget.files?.[0]?.name ?? '')} /></label><label>Subtotal (B/.)<input name="subtotal" type="number" min="0" step="0.01" required /></label><label>Tasa ITBMS<input name="itbmsRate" type="number" min="0" max="1" step="0.01" defaultValue="0.07" required /></label><label><span>Notas</span><textarea name="notes" maxLength={1000} /></label><Button disabled={sending}>{sending ? 'Enviando…' : 'Enviar factura'}</Button></form><Notice status={status} /></section>;
}
