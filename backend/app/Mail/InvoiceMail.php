<?php

namespace App\Mail;

use App\Models\Invoice;
use App\Services\Billing\BillingDocuments;
use App\Support\Brand;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/** M11/M18 Invoice email, sent when an invoice is issued with a balance for the Patient to pay. The PDF copy is attached. */
class InvoiceMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public Invoice $invoice) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Invoice '.$this->invoice->invoice_number.' - '.Brand::name());
    }

    public function content(): Content
    {
        return new Content(view: 'emails.invoice', text: 'emails.invoice-text', with: app(BillingDocuments::class)->invoice($this->invoice) + [
            'subjectLine' => $this->envelope()->subject, 'portalUrl' => Brand::invoiceUrl($this->invoice->public_id),
            'firstName' => $this->invoice->patient?->person?->first_name ?: 'there',
        ]);
    }

    public function attachments(): array
    {
        return [Attachment::fromData(fn () => app(BillingDocuments::class)->invoicePdf($this->invoice), BillingDocuments::invoiceFileName($this->invoice))
            ->withMime('application/pdf')];
    }
}
