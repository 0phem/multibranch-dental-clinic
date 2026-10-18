<?php

namespace App\Mail;

use App\Models\Invoice;
use App\Support\Brand;
use App\Support\ClinicClock;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/** A3: the invoice number, the balance and the Pay online link. Never the treatment lines. */
class InvoiceOverdueMail extends AutomationMail
{
    public function __construct(public Invoice $invoice) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->w()['subject']);
    }

    private function w(): array
    {
        $i = $this->invoice;

        return $this->wording('invoice_overdue', ['first_name' => $i->patient?->person?->first_name ?: 'there', 'branch' => $i->branch?->name ?? 'the clinic',
            'invoice_number' => $i->invoice_number, 'balance' => Brand::money($i->balance())]);
    }

    public function content(): Content
    {
        $i = $this->invoice;

        return new Content(view: 'emails.invoice-overdue', text: 'emails.invoice-overdue-text', with: [
            'invoice' => $i, 'branch' => $i->branch, 'test' => $this->test, 'subjectLine' => $this->envelope()->subject,
            'firstName' => $i->patient?->person?->first_name ?: 'there', 'balance' => Brand::money($i->balance()),
            'issuedOn' => $i->issued_at ? ClinicClock::local($i->issued_at)->format('F j, Y') : null, 'payUrl' => Brand::invoiceUrl((string) $i->public_id), 'paragraphs' => $this->w()['paragraphs'],
        ]);
    }
}
